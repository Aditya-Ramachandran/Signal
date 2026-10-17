'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { jobs as initialJobs, outreachContacts, type Job } from '../lib/sampleData';
import { supabase } from '../lib/supabase';
import Welcome from './welcome/page';

type Filter = 'All' | 'A' | 'B' | 'Applied' | 'Referred';
type View = 'today' | 'saved' | 'later' | 'outreach';
type JobMeta = { saved?: boolean; snoozedUntil?: string };
type StoredStatuses = Record<string, Job['status']>;
type BridgeResponse = { ok?: boolean; jobs?: Record<string, unknown>[]; error?: string };
type ProgressRow = { job_id: string; status: Job['status']; saved: boolean; snoozed_until: string | null };
type WorkspaceStatus = 'checking' | 'ready' | 'needs-setup' | 'unavailable';

const STATUS_STORAGE_KEY = 'signal-job-statuses';
const META_STORAGE_KEY = 'signal-job-meta';
const LEAD_REVIEWED_KEY = 'signal-lead-reviewed';

function readJson<T>(key: string, fallback: T): T {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function withSavedStatuses(items: Job[], statuses = readJson<StoredStatuses>(STATUS_STORAGE_KEY, {})) { return items.map((job) => statuses[job.id] ? { ...job, status: statuses[job.id] } : job); }
function isAccountRoute() { return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('app'); }
function stringValue(value: unknown, fallback = '') { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() || fallback : fallback; }
function field(row: Record<string, unknown>, ...names: string[]) { const match = Object.entries(row).find(([key]) => names.some((name) => key.toLowerCase() === name.toLowerCase())); return match ? stringValue(match[1]) : ''; }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date); }
function daysAgo(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? 0 : Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000)); }
function tomorrow() { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); }
function isSnoozed(meta: JobMeta | undefined) { return Boolean(meta?.snoozedUntil && new Date(`${meta.snoozedUntil}T00:00:00`).getTime() > Date.now()); }
function contactsSearchLink(job: Job) { return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`"${job.company}" AND ("engineering manager" OR "tech lead" OR recruiter)`)}`; }
function postedLabel(job: Job) { return job.postedDaysAgo === 0 ? 'posted today' : `posted ${job.postedDaysAgo} day${job.postedDaysAgo > 1 ? 's' : ''} ago`; }

function jobsFromBridge(payload: BridgeResponse): Job[] {
  if (!payload.ok || !Array.isArray(payload.jobs)) return [];
  return payload.jobs.map((row, index) => {
    const company = field(row, 'Company', 'company') || 'Unknown company';
    const role = field(row, 'Role', 'role') || 'Backend role';
    const postedDate = field(row, 'Posted', 'Posted Date', 'postedDate');
    const dateFound = field(row, 'Date Found', 'dateFound') || postedDate;
    const rawStatus = field(row, 'Status', 'status');
    const status: Job['status'] = ['New', 'Applied', 'Referred', 'Rejected'].includes(rawStatus) ? rawStatus as Job['status'] : 'New';
    const tier: Job['tier'] = field(row, 'Tier', 'tier').toUpperCase() === 'A' ? 'A' : 'B';
    const jobId = field(row, 'Job ID', 'jobId') || `live-${index + 1}`;
    return {
      id: jobId, company, role,
      location: field(row, 'Location', 'location') || 'Location not stated',
      companySize: field(row, 'Company Size', 'companySize') || 'Unknown',
      postedDate: formatDate(postedDate), postedDaysAgo: daysAgo(postedDate),
      experience: field(row, 'Experience', 'experience') || 'Not stated',
      salary: field(row, 'Salary (source)', 'Salary', 'salary') || 'Not disclosed',
      applyLink: field(row, 'Link', 'Apply Link', 'applyLink') || '#', jobId,
      idType: field(row, 'ID Type', 'idType') || 'portal', tier, status,
      whyFit: field(row, 'Why it fits', 'Why Fit', 'whyFit') || 'Relevant backend opening from your daily search.',
      referralMessage: field(row, 'Referral Message', 'referralMessage') || `Hi {Name}, I’m interested in the ${role} role at ${company}. Would you be open to pointing me to the right hiring contact?`,
      findContactsLink: field(row, 'Find Contacts Link', 'findContactsLink') || contactsSearchLink({ company } as Job),
      dateFound: formatDate(dateFound),
    };
  }).sort((a, b) => a.tier.localeCompare(b.tier) || a.postedDaysAgo - b.postedDaysAgo);
}

function InfoTip({ label, children }: { label: string; children: string }) {
  return <span className="info-tip"><button type="button" aria-label={label}>i</button><span role="tooltip">{children}</span></span>;
}

export default function Home() {
  const [showDashboard, setShowDashboard] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('demo')) { setShowDashboard(true); return; }
    if (!params.has('app') || !supabase) return;
    const client = supabase;
    const openWorkspace = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user?.email) return;
      const { data } = await client.from('allowed_users').select('email').eq('email', user.email.toLowerCase()).maybeSingle();
      setShowDashboard(Boolean(data));
    };
    void openWorkspace();
  }, []);
  return showDashboard ? <Dashboard /> : <Welcome />;
}

function Dashboard() {
  const [activeView, setActiveView] = useState<View>('today');
  const [filter, setFilter] = useState<Filter>('All');
  const [jobState, setJobState] = useState<Job[]>(initialJobs);
  const [jobMeta, setJobMeta] = useState<Record<string, JobMeta>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toast, setToast] = useState('');
  const [undoAction, setUndoAction] = useState<null | (() => void)>(null);
  const [isGuestDemo, setIsGuestDemo] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [leadMessageOpen, setLeadMessageOpen] = useState(true);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>('checking');
  const [jobsFeedUrl, setJobsFeedUrl] = useState('');
  const [remoteProgressReady, setRemoteProgressReady] = useState(false);
  const [progressUserId, setProgressUserId] = useState('');
  const [progressScope, setProgressScope] = useState<'device' | 'account'>('device');
  const [accountEmail, setAccountEmail] = useState('');
  const reducedMotion = useReducedMotion();
  const briefingDate = jobState[0]?.dateFound || '17 Oct 2026';

  const announce = (message: string, undo?: () => void) => { setToast(message); setUndoAction(() => undo ?? null); };
  useEffect(() => { const saved = window.localStorage.getItem('signal-theme'); if (saved === 'dark') setTheme('dark'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('signal-theme', theme); }, [theme]);
  useEffect(() => { const guestDemo = new URLSearchParams(window.location.search).has('demo'); setIsGuestDemo(guestDemo); if (guestDemo) { setWorkspaceStatus('ready'); setIsLoadingJobs(false); } setLeadMessageOpen(!Boolean(window.localStorage.getItem(LEAD_REVIEWED_KEY))); setRouteReady(true); }, []);
  useEffect(() => { window.localStorage.setItem(LEAD_REVIEWED_KEY, 'true'); }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => { setToast(''); setUndoAction(null); }, 5000); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (isGuestDemo || !supabase) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => { if (!cancelled) setAccountEmail(data.user?.email || ''); });
    return () => { cancelled = true; };
  }, [isGuestDemo]);
  useEffect(() => { if (!isAccountRoute()) { const statuses = readJson<StoredStatuses>(STATUS_STORAGE_KEY, {}); setJobState((items) => withSavedStatuses(items, statuses)); setJobMeta(readJson<Record<string, JobMeta>>(META_STORAGE_KEY, {})); } setHasRestoredProgress(true); }, []);
  useEffect(() => { if (hasRestoredProgress && !isAccountRoute()) window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(Object.fromEntries(jobState.map((job) => [job.id, job.status])))); }, [hasRestoredProgress, jobState]);
  useEffect(() => { if (hasRestoredProgress && !isAccountRoute()) window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(jobMeta)); }, [hasRestoredProgress, jobMeta]);
  useEffect(() => {
    if (!routeReady || isGuestDemo) return;
    const client = supabase;
    if (!client) { setWorkspaceStatus('unavailable'); setIsLoadingJobs(false); return; }
    let cancelled = false;
    const loadWorkspaceSettings = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user || cancelled) { setWorkspaceStatus('needs-setup'); setIsLoadingJobs(false); return; }
      const { data, error } = await client.from('user_settings').select('jobs_feed_url').maybeSingle();
      if (cancelled) return;
      const feedUrl = data?.jobs_feed_url?.trim();
      if (error) { setWorkspaceStatus('unavailable'); setIsLoadingJobs(false); return; }
      if (!feedUrl) { setWorkspaceStatus('needs-setup'); setIsLoadingJobs(false); return; }
      setJobsFeedUrl(feedUrl);
      setWorkspaceStatus('ready');
    };
    void loadWorkspaceSettings();
    return () => { cancelled = true; };
  }, [isGuestDemo, routeReady]);
  useEffect(() => {
    if (!hasRestoredProgress || !routeReady) return;
    const client = supabase;
    if (isGuestDemo || !client) { setRemoteProgressReady(true); return; }
    let cancelled = false;
    const restoreAccountProgress = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user || cancelled) { setRemoteProgressReady(true); return; }
      const { data, error } = await client.from('job_progress').select('job_id,status,saved,snoozed_until');
      if (cancelled) return;
      if (error) { setRemoteProgressReady(true); return; }
      const rows = (data || []) as ProgressRow[];
      const byJob = new Map(rows.map((row) => [row.job_id, row]));
      setJobState((items) => items.map((job) => { const row = byJob.get(job.id); return { ...job, status: row ? row.status : 'New' }; }));
      setJobMeta(Object.fromEntries(rows.map((row) => [row.job_id, { saved: row.saved, ...(row.snoozed_until ? { snoozedUntil: row.snoozed_until } : {}) }])));
      setProgressUserId(user.id);
      setProgressScope('account');
      setRemoteProgressReady(true);
    };
    void restoreAccountProgress();
    return () => { cancelled = true; };
  }, [hasRestoredProgress, isGuestDemo, routeReady]);
  useEffect(() => {
    const client = supabase;
    if (!hasRestoredProgress || !remoteProgressReady || !progressUserId || isGuestDemo || workspaceStatus !== 'ready' || !client) return;
    const rows = jobState.map((job) => ({ user_id: progressUserId, job_id: job.id, status: job.status, saved: Boolean(jobMeta[job.id]?.saved), snoozed_until: jobMeta[job.id]?.snoozedUntil || null, updated_at: new Date().toISOString() }));
    void client.from('job_progress').upsert(rows, { onConflict: 'user_id,job_id' });
  }, [hasRestoredProgress, isGuestDemo, jobMeta, jobState, progressUserId, remoteProgressReady, workspaceStatus]);

  const loadLiveJobs = async () => {
    if (new URLSearchParams(window.location.search).has('demo') || !jobsFeedUrl) return false;
    setIsLoadingJobs(true);
    try {
      const response = await fetch(jobsFeedUrl, { cache: 'no-store' });
      const payload = await response.json() as BridgeResponse;
      const liveJobs = jobsFromBridge(payload);
      if (!response.ok || !liveJobs.length) throw new Error(payload.error || 'No jobs returned');
      setJobState(isAccountRoute() ? liveJobs : withSavedStatuses(liveJobs));
      return true;
    } catch { announce('Your jobs feed is unavailable. Check the setup guide, then try again.'); setJobState([]); return false; } finally { setIsLoadingJobs(false); }
  };
  useEffect(() => { if (routeReady && !isGuestDemo && workspaceStatus === 'ready' && jobsFeedUrl) void loadLiveJobs(); }, [isGuestDemo, jobsFeedUrl, routeReady, workspaceStatus]);

  const workspaceJobs = workspaceStatus === 'ready' ? jobState : [];
  const todayJobs = useMemo(() => workspaceJobs.filter((job) => job.status !== 'Rejected' && !jobMeta[job.id]?.saved && !isSnoozed(jobMeta[job.id])), [jobMeta, workspaceJobs]);
  const savedJobs = useMemo(() => workspaceJobs.filter((job) => job.status !== 'Rejected' && jobMeta[job.id]?.saved && !isSnoozed(jobMeta[job.id])), [jobMeta, workspaceJobs]);
  const laterJobs = useMemo(() => workspaceJobs.filter((job) => isSnoozed(jobMeta[job.id])), [jobMeta, workspaceJobs]);
  const activeJobs = activeView === 'saved' ? savedJobs : activeView === 'later' ? laterJobs : todayJobs;
  // Outreach is real only when a user's pipeline supplies it. Sample contacts belong to guest demo only.
  const workspaceOutreach = isGuestDemo ? outreachContacts : [];
  const hasOutreach = workspaceOutreach.length > 0;
  const filteredJobs = useMemo(() => activeJobs.filter((job) => activeView !== 'today' || filter === 'All' || (filter === 'A' && job.tier === 'A') || (filter === 'B' && job.tier === 'B') || job.status === filter), [activeJobs, activeView, filter]);
  const lead = filteredJobs[0];
  const queuedJobs = lead ? filteredJobs.filter((job) => job.id !== lead.id) : [];
  const newToday = workspaceJobs.filter((job) => job.dateFound === briefingDate);
  const handledToday = newToday.filter((job) => job.status !== 'New' || jobMeta[job.id]?.saved || isSnoozed(jobMeta[job.id])).length;

  const setStatus = (id: string, status: Job['status']) => {
    const previous = jobState.find((job) => job.id === id)?.status || 'New';
    setJobState((items) => items.map((job) => job.id === id ? { ...job, status } : job));
    const message = status === 'Applied' ? 'Marked as applied on this device' : status === 'Rejected' ? 'Removed from your queue' : `Marked as ${status.toLowerCase()} on this device`;
    announce(message, () => setJobState((items) => items.map((job) => job.id === id ? { ...job, status: previous } : job)));
  };
  const toggleSaved = (id: string) => {
    const previous = jobMeta[id] || {};
    const next = !previous.saved;
    setJobMeta((items) => ({ ...items, [id]: { ...previous, saved: next } }));
    announce(next ? 'Saved on this device' : 'Moved back to Today', () => setJobMeta((items) => ({ ...items, [id]: previous })));
  };
  const snooze = (id: string) => {
    const previous = jobMeta[id] || {};
    setJobMeta((items) => ({ ...items, [id]: { ...previous, snoozedUntil: tomorrow() } }));
    announce('Snoozed until tomorrow morning', () => setJobMeta((items) => ({ ...items, [id]: previous })));
  };
  const unsnooze = (id: string) => {
    const previous = jobMeta[id] || {};
    const { snoozedUntil: _snoozedUntil, ...next } = previous;
    setJobMeta((items) => ({ ...items, [id]: next }));
    announce('Moved back to Today', () => setJobMeta((items) => ({ ...items, [id]: previous })));
  };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); announce('Message copied'); } catch { announce('Copy unavailable — select the message manually'); } };
  const reviewLeadMessage = () => { setLeadMessageOpen(true); window.localStorage.setItem(LEAD_REVIEWED_KEY, 'true'); };
  const refresh = async () => { if (isGuestDemo) { announce('Demo queue refreshed'); return; } if (workspaceStatus !== 'ready') { announce('Finish your workspace setup before refreshing.'); return; } if (await loadLiveJobs()) announce('Queue refreshed from your tracker'); };
  const signOut = async () => { await supabase?.auth.signOut(); const basePath = window.location.hostname.endsWith('github.io') ? '/Signal/' : '/'; window.location.assign(basePath); };
  const moveToWorkspace = () => { window.requestAnimationFrame(() => document.getElementById('workspace-content')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })); };
  const chooseView = (view: View) => { setActiveView(view); setFilter('All'); setExpandedId(null); moveToWorkspace(); };
  const chooseFilter = (nextFilter: Filter) => { setFilter(nextFilter); setExpandedId(null); moveToWorkspace(); };
  const motionProps = reducedMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: .35, ease: 'easeOut' as const } };
  const showQueueSkeleton = !isGuestDemo && (workspaceStatus === 'checking' || (isLoadingJobs && workspaceStatus === 'ready'));

  return <main className="shell">
    <header className="masthead"><div className="brand"><span className="mark" aria-hidden="true"/><div><div className="wordmark">Signal</div><div className="tagline">Less noise. More signal.</div></div></div><div className="mast-actions"><span className="date mono">SAT, 17 OCT 2026</span><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span></button><button className="refresh" onClick={refresh}>Refresh queue</button>{!isGuestDemo && <div className="account-identity">{accountEmail && <span title={accountEmail}>{accountEmail}</span>}<button className="dashboard-signout" onClick={signOut}>Sign out</button></div>}</div></header>
    {isGuestDemo && <aside className="guest-notice"><div><span className="mono">GUEST DEMO</span><strong>Sample roles, real workflow — nothing is sent.</strong></div><a href="https://github.com/Aditya-Ramachandran/Signal" target="_blank" rel="noreferrer">Liked this? Set up your own Signal ↗</a></aside>}
    <motion.section className="stats" aria-label="Queue summary" {...(reducedMotion ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: .08, duration: .35 } })}><Stat value={String(newToday.length)} label="new today"/><Stat value={String(todayJobs.filter((job) => job.tier === 'A').length)} label="worth a referral"/><Stat value={isLoadingJobs ? '…' : '08:12'} label={isLoadingJobs ? 'loading tracker' : 'updated, IST'}/></motion.section>
    {(isGuestDemo || workspaceStatus === 'ready') && <div className="workspace-bar"><nav className="view-tabs queue-tabs" aria-label="Job queues"><button className={`view-tab ${activeView === 'today' ? 'active' : ''}`} onClick={() => chooseView('today')}>Today</button><button className={`view-tab ${activeView === 'saved' ? 'active' : ''}`} onClick={() => chooseView('saved')}>Saved <span className="tab-count mono">{savedJobs.length}</span></button><button className={`view-tab ${activeView === 'later' ? 'active' : ''}`} onClick={() => chooseView('later')}>Later <span className="tab-count mono">{laterJobs.length}</span></button></nav><div className={`outreach-control ${hasOutreach ? '' : 'unavailable'}`}><button className={`outreach-launch ${activeView === 'outreach' ? 'active' : ''}`} onClick={() => chooseView('outreach')} disabled={!hasOutreach}><span>Outreach desk</span><small>{hasOutreach ? <><b className="mono">{workspaceOutreach.filter((contact) => contact.emailInferred).length}</b> drafts ready</> : 'Run outreach to unlock'}</small></button><InfoTip label="What is the Outreach desk?">{hasOutreach ? 'A separate workspace for reviewing inferred-email drafts, not a job filter.' : 'Run your optional outreach task first. Signal will unlock this desk when its drafts are available.'}</InfoTip></div></div>}
    {showQueueSkeleton ? <QueueSkeleton/> : workspaceStatus !== 'ready' ? <WorkspaceSetupRequired unavailable={workspaceStatus === 'unavailable'}/> : <AnimatePresence mode="wait">{activeView !== 'outreach' ? <motion.section id="workspace-content" key={activeView} className="view active" {...motionProps}><div className="section-head"><div><h2>{activeView === 'today' ? 'Morning queue' : activeView === 'saved' ? 'Saved for later' : 'Coming back later'}</h2><p className="queue-progress">{activeView === 'today' ? <><span className="mono">{handledToday}/{newToday.length}</span> new roles actioned today <span className="storage-note">{progressScope === 'account' ? 'Progress syncs with your account.' : 'Progress is saved on this device.'}</span></> : activeView === 'saved' ? 'Roles you deliberately kept for another pass.' : 'Snoozed roles return to Today tomorrow morning.'}</p></div>{activeView === 'today' && <div className="filters" role="tablist" aria-label="Filter jobs">{(['All', 'A', 'B', 'Applied', 'Referred'] as Filter[]).map((item) => <span className="filter-control" key={item}><button className={`filter ${filter === item ? 'active' : ''}`} onClick={() => chooseFilter(item)}>{item === 'A' ? 'Tier A' : item === 'B' ? 'Tier B' : item}{item === 'All' && <span className="mono"> {todayJobs.length}</span>}</button>{item === 'A' && <InfoTip label="How is Tier A calculated?">Tier A roles are fresh, relevant backend openings where a referral is worth the effort.</InfoTip>}{item === 'B' && <InfoTip label="How is Tier B calculated?">Tier B roles are credible matches to apply to directly; use a referral when you already have a warm contact.</InfoTip>}</span>)}</div>}</div>{lead ? <><LeadJob job={lead} view={activeView} saved={Boolean(jobMeta[lead.id]?.saved)} messageOpen={leadMessageOpen} onReviewMessage={reviewLeadMessage} onCopy={copy} onNeedName={() => announce('Add a contact name before copying')} onStatus={setStatus} onSave={toggleSaved} onSnooze={snooze} onUnsnooze={unsnooze}/><LayoutGroup><div className="job-list">{queuedJobs.map((job) => <JobRow key={job.id} job={job} view={activeView} saved={Boolean(jobMeta[job.id]?.saved)} rank={jobState.indexOf(job) + 1} expanded={expandedId === job.id} onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)} onCopy={copy} onNeedName={() => announce('Add a contact name before copying')} onStatus={setStatus} onSave={toggleSaved} onSnooze={snooze} onUnsnooze={unsnooze} reducedMotion={reducedMotion}/>)}</div></LayoutGroup></> : <div className="empty">{activeView === 'today' ? 'Nothing new today.' : activeView === 'saved' ? 'No saved roles yet.' : 'Nothing is snoozed.'}</div>}</motion.section> : <motion.section id="workspace-content" key="outreach" className="view active" {...motionProps}><div className="section-head outreach-head"><div><h2>Outreach desk</h2><p className="intro-copy compact">Ready-to-review drafts for people close to your strongest roles. Verify an inferred email, then open Gmail when the note is right.</p></div><button className="back-to-queue" onClick={() => chooseView('today')}>Back to queue</button></div><div className="outreach-list">{workspaceOutreach.map((contact) => <OutreachRow key={contact.id} contact={contact} onCopy={copy}/>)}</div></motion.section>}</AnimatePresence>}
    <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite"><span>{toast}</span>{undoAction && <button onClick={() => { undoAction(); announce('Change undone'); }}>Undo</button>}</div>
  </main>;
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="stat"><div className="stat-value mono">{value}</div><div className="stat-label">{label}</div></div>; }
function WorkspaceSetupRequired({ unavailable }: { unavailable: boolean }) {
  const basePath = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io') ? '/Signal/' : '/';
  return <section id="workspace-content" className="workspace-empty">
    <div><h2>{unavailable ? 'Your workspace needs attention.' : 'No jobs feed connected yet.'}</h2><p>{unavailable ? 'We could not read your private workspace settings. Check your Signal setup, then refresh this page.' : 'This Google account has its own private workspace, but no jobs feed has been connected yet.'}</p></div>
    <div className="workspace-empty-actions"><a className="btn primary" href={`${basePath}?setup=1`}>Connect jobs feed</a><a className="text-action" href="https://github.com/Aditya-Ramachandran/Signal" target="_blank" rel="noreferrer">Read the setup guide ↗</a></div>
  </section>;
}
function QueueSkeleton() { return <section id="workspace-content" className="queue-skeleton" aria-busy="true" aria-label="Loading your job tracker"><div className="skeleton-heading"><span/><span/></div><div className="skeleton-lead"><span/><span/><span/></div><div className="skeleton-row"><span/><span/><span/><span/></div><div className="skeleton-row"><span/><span/><span/><span/></div><div className="skeleton-row"><span/><span/><span/><span/></div></section>; }

type ActionsProps = { job: Job; view: Exclude<View, 'outreach'>; saved: boolean; onCopy: (text: string) => void; onNeedName: () => void; onStatus: (id: string, status: Job['status']) => void; onSave: (id: string) => void; onSnooze: (id: string) => void; onUnsnooze: (id: string) => void; };
function JobActions({ job, view, saved, onCopy, onNeedName, onStatus, onSave, onSnooze, onUnsnooze }: ActionsProps) {
  const [contactName, setContactName] = useState('');
  const needsName = job.referralMessage.includes('{Name}');
  const copyMessage = () => { if (needsName && !contactName.trim()) { onNeedName(); return; } onCopy(job.referralMessage.replaceAll('{Name}', contactName.trim())); };
  return <><div className="actions"><button className="btn primary" onClick={copyMessage}>Copy message</button><a className="btn" href={contactsSearchLink(job)} target="_blank" rel="noreferrer">Find a person</a><a className="btn" href={job.applyLink} target="_blank" rel="noreferrer">Apply ↗</a><details className="action-menu"><summary>More</summary><div><button onClick={() => onStatus(job.id, 'Applied')}>I applied</button><button onClick={() => onSave(job.id)}>{saved ? 'Move to Today' : 'Save for later'}</button>{view === 'later' ? <button onClick={() => onUnsnooze(job.id)}>Bring back today</button> : <button onClick={() => onSnooze(job.id)}>Snooze until tomorrow</button>}<button onClick={() => onStatus(job.id, 'Rejected')}>Not a fit</button></div></details></div>{needsName && <label className="contact-name-input">Contact first name <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="e.g. Priya"/> <span>Required before copying.</span></label>}</>;
}

function LeadJob({ job, view, saved, messageOpen, onReviewMessage, ...actions }: ActionsProps & { messageOpen: boolean; onReviewMessage: () => void }) { return <article className={`lead tier-${job.tier.toLowerCase()}`}><div><div className="lead-kicker">{view === 'today' ? 'Best next move' : view === 'saved' ? 'Saved role' : 'Snoozed role'} · Tier {job.tier}</div><h2>{job.role}</h2><div className="company">{job.company}</div><div className="facts lead-facts"><span>{job.location}</span><span>{job.experience}</span><span>{job.salary}</span><span>{postedLabel(job)}</span></div></div><div className="lead-why"><p>{job.whyFit}</p><div className="facts"><span>{job.companySize}</span><span>Listing ref. {job.jobId}</span></div></div><div className="message"><div className="message-label">Referral message · {job.jobId}</div>{messageOpen ? <p>{job.referralMessage}</p> : <p className="message-preview">A tailored referral note is ready when you need it.</p>}{!messageOpen && <button className="review-note" onClick={onReviewMessage}>Review referral note</button>}<JobActions job={job} view={view} saved={saved} {...actions}/></div></article>; }

function JobRow({ job, view, saved, rank, expanded, onToggle, reducedMotion, ...actions }: ActionsProps & { rank: number; expanded: boolean; onToggle: () => void; reducedMotion: boolean | null }) { return <motion.article layout className={`job-row ${expanded ? 'expanded' : ''}`} transition={reducedMotion ? { duration: 0 } : { duration: .25 }}><button className="job-main" aria-expanded={expanded} onClick={onToggle}><span className="rank">{String(rank).padStart(2, '0')}</span><span className="role">{job.role}<small>{job.company}</small>{job.tier === 'A' && <small className="rank-reason">Worth a referral attempt</small>}</span><span className="job-meta">{job.location}<small>{job.experience}</small></span><span className="job-meta">{job.postedDaysAgo === 0 ? 'today' : `${job.postedDaysAgo} days ago`}<small>{saved ? 'Saved' : job.status}</small></span><span className={`tier ${job.tier === 'A' ? 'a' : ''}`} aria-label={`Tier ${job.tier}${job.tier === 'A' ? ': worth a referral attempt' : ''}`}>Tier {job.tier}</span><span className="chevron">⌄</span></button><AnimatePresence initial={false}>{expanded && <motion.div className="job-detail" initial={reducedMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}><p className="job-detail-copy"><strong>Why it fits.</strong> {job.whyFit}</p><div className="message-label">Referral message · {job.jobId}</div><p className="job-detail-copy">{job.referralMessage}</p><JobActions job={job} view={view} saved={saved} {...actions}/></motion.div>}</AnimatePresence></motion.article>; }

function inferEmail(contact: (typeof outreachContacts)[number]) { return `${contact.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@${contact.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`; }
function gmailComposeLink(contact: (typeof outreachContacts)[number], email: string) { return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(`Referral request — ${contact.company}`)}&body=${encodeURIComponent(contact.emailDraft)}`; }
function OutreachRow({ contact, onCopy }: { contact: (typeof outreachContacts)[number]; onCopy: (text: string) => void }) { const email = contact.emailInferred ? inferEmail(contact) : null; return <article className="contact"><div><div className="contact-name">{contact.name}</div><div className="contact-meta">{contact.role}<br/>{contact.company}</div></div><div className="contact-meta"><a className="contact-profile" href={contact.profileUrl} target="_blank" rel="noreferrer">View profile</a>{email ? <><span className="inferred-email mono">{email}</span><span className="inferred">Inferred, unverified — verify before sending</span></> : <span className="contact-note">No inferred email</span>}</div><div className="draft">{contact.emailDraft}</div><div className="contact-actions">{email && <a className="btn primary" href={gmailComposeLink(contact, email)} target="_blank" rel="noreferrer">Open Gmail</a>}<button className="btn" onClick={() => onCopy(contact.emailDraft)}>Copy draft</button></div></article>; }
