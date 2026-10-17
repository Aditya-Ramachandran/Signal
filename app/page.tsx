'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { jobs as initialJobs, outreachContacts, type Job } from '../lib/sampleData';

type Filter = 'All' | 'A' | 'B' | 'Applied' | 'Referred';
type View = 'today' | 'outreach';
type BridgeResponse = { ok?: boolean; jobs?: Record<string, unknown>[]; error?: string };
type JobMeta = { saved?: boolean; snoozedUntil?: string };
type StoredStatuses = Record<string, Job['status']>;

const liveJobsUrl = process.env.NEXT_PUBLIC_SIGNAL_JOBS_URL;
const STATUS_STORAGE_KEY = 'signal-job-statuses';
const META_STORAGE_KEY = 'signal-job-meta';

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

function withSavedStatuses(items: Job[], statuses = readJson<StoredStatuses>(STATUS_STORAGE_KEY, {})) {
  return items.map((job) => statuses[job.id] ? { ...job, status: statuses[job.id] } : job);
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isSnoozed(meta: JobMeta | undefined) {
  return Boolean(meta?.snoozedUntil && new Date(`${meta.snoozedUntil}T23:59:59`).getTime() > Date.now());
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() || fallback : fallback;
}

function field(row: Record<string, unknown>, ...names: string[]) {
  const match = Object.entries(row).find(([key]) => names.some((name) => key.toLowerCase() === name.toLowerCase()));
  return match ? stringValue(match[1]) : '';
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function daysAgo(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
}

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
    const applyLink = field(row, 'Link', 'Apply Link', 'applyLink');
    const findContactsLink = field(row, 'Find Contacts Link', 'findContactsLink') || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${company} ${role}`)}`;

    return {
      id: jobId,
      company,
      role,
      location: field(row, 'Location', 'location') || 'Location not stated',
      companySize: field(row, 'Company Size', 'companySize') || 'Unknown',
      postedDate: formatDate(postedDate),
      postedDaysAgo: daysAgo(postedDate),
      experience: field(row, 'Experience', 'experience') || 'Not stated',
      salary: field(row, 'Salary (source)', 'Salary', 'salary') || 'Not disclosed',
      applyLink: applyLink || '#',
      jobId,
      idType: field(row, 'ID Type', 'idType') || 'portal',
      tier,
      status,
      whyFit: field(row, 'Why it fits', 'Why Fit', 'whyFit') || 'Relevant backend opening from your daily search.',
      referralMessage: field(row, 'Referral Message', 'referralMessage') || `Hi — I’m interested in the ${role} role at ${company}. Would you be open to pointing me to the right hiring contact?`,
      findContactsLink,
      dateFound: formatDate(dateFound),
    };
  }).sort((a, b) => a.tier.localeCompare(b.tier) || a.postedDaysAgo - b.postedDaysAgo);
}

function SunIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>; }
function MoonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z"/></svg>; }

export default function Home() {
  const [activeView, setActiveView] = useState<View>('today');
  const [filter, setFilter] = useState<Filter>('All');
  const [jobState, setJobState] = useState<Job[]>(initialJobs);
  const [jobMeta, setJobMeta] = useState<Record<string, JobMeta>>({});
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(Boolean(liveJobsUrl));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toast, setToast] = useState('');
  const reducedMotion = useReducedMotion();
  const briefingDate = jobState[0]?.dateFound || '17 Oct 2026';
  const lastRun = '08:12';

  useEffect(() => { const saved = window.localStorage.getItem('signal-theme'); if (saved === 'dark') setTheme('dark'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('signal-theme', theme); }, [theme]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const statuses = readJson<StoredStatuses>(STATUS_STORAGE_KEY, {});
    setJobState((items) => withSavedStatuses(items, statuses));
    setJobMeta(readJson<Record<string, JobMeta>>(META_STORAGE_KEY, {}));
    setHasRestoredProgress(true);
  }, []);
  useEffect(() => {
    if (!hasRestoredProgress) return;
    const statuses = Object.fromEntries(jobState.map((job) => [job.id, job.status]));
    window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(statuses));
  }, [hasRestoredProgress, jobState]);
  useEffect(() => {
    if (hasRestoredProgress) window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(jobMeta));
  }, [hasRestoredProgress, jobMeta]);

  const loadLiveJobs = async () => {
    if (!liveJobsUrl) return false;
    setIsLoadingJobs(true);
    try {
      const response = await fetch(liveJobsUrl, { cache: 'no-store' });
      const payload = await response.json() as BridgeResponse;
      const liveJobs = jobsFromBridge(payload);
      if (!response.ok || !liveJobs.length) throw new Error(payload.error || 'No jobs returned');
      setJobState(withSavedStatuses(liveJobs));
      return true;
    } catch {
      setToast('Live jobs unavailable — showing the saved sample queue');
      return false;
    } finally {
      setIsLoadingJobs(false);
    }
  };

  useEffect(() => { void loadLiveJobs(); }, []); // The URL is injected at build time for the static export.

  const visibleJobs = useMemo(() => jobState.filter((job) => job.status !== 'Rejected' && !isSnoozed(jobMeta[job.id])), [jobMeta, jobState]);
  const filteredJobs = useMemo(() => visibleJobs.filter((job) => filter === 'All' || (filter === 'A' && job.tier === 'A') || (filter === 'B' && job.tier === 'B') || job.status === filter), [filter, visibleJobs]);
  const lead = filteredJobs[0];
  const queuedJobs = lead ? filteredJobs.filter((job) => job.id !== lead.id) : [];
  const newToday = jobState.filter((job) => job.dateFound === briefingDate);
  const handledToday = newToday.filter((job) => job.status !== 'New' || jobMeta[job.id]?.saved || isSnoozed(jobMeta[job.id])).length;
  const setStatus = (id: string, status: Job['status']) => { setJobState((items) => items.map((job) => job.id === id ? { ...job, status } : job)); setToast(status === 'Applied' ? 'Marked as applied' : status === 'Rejected' ? 'Removed from today’s queue' : `Status updated to ${status}`); };
  const toggleSaved = (id: string) => { setJobMeta((items) => ({ ...items, [id]: { ...items[id], saved: !items[id]?.saved } })); setToast(jobMeta[id]?.saved ? 'Removed from saved' : 'Saved for later'); };
  const snooze = (id: string) => { setJobMeta((items) => ({ ...items, [id]: { ...items[id], snoozedUntil: tomorrow() } })); setToast('Snoozed until tomorrow'); };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setToast('Copied to clipboard'); } catch { setToast('Copy unavailable — select the text manually'); } };
  const refresh = async () => {
    if (await loadLiveJobs()) setToast('Queue refreshed from your tracker');
    else if (!liveJobsUrl) setToast('Add NEXT_PUBLIC_SIGNAL_JOBS_URL to load your tracker');
  };
  const motionProps = reducedMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: .45, ease: 'easeOut' as const } };

  return <main className="shell">
    <header className="masthead">
      <div className="brand"><span className="mark" aria-hidden="true"/><div><div className="wordmark">Signal</div><div className="tagline">Less noise. More signal.</div></div></div>
      <div className="mast-actions"><span className="date mono">SAT, 17 OCT 2026</span><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <SunIcon/> : <MoonIcon/>}<span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span></button><button className="refresh" onClick={refresh}>Refresh queue</button></div>
    </header>

    <motion.section className="stats" aria-label="Queue summary" {...(reducedMotion ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: .08, duration: .4 } })}>
      <Stat value={String(jobState.filter((job) => job.dateFound === briefingDate).length)} label="new today"/><Stat value={String(jobState.filter((job) => job.tier === 'A').length)} label="Tier A roles"/><Stat value={isLoadingJobs ? '…' : lastRun} label={isLoadingJobs ? 'loading tracker' : 'last run, IST'}/>
    </motion.section>

    <nav className="view-tabs" aria-label="Views">{(['today', 'outreach'] as View[]).map((view) => <button key={view} className={`view-tab ${activeView === view ? 'active' : ''}`} onClick={() => setActiveView(view)}>{view === 'today' ? 'Today' : 'Outreach'}</button>)}</nav>

    <AnimatePresence mode="wait">{activeView === 'today' ? <motion.section key="today" className="view active" {...motionProps}>
      <div className="section-head"><div><h2>Morning queue</h2><p className="queue-progress"><span className="mono">{handledToday}/{newToday.length}</span> new roles actioned today</p></div><div className="filters" role="tablist" aria-label="Filter jobs">{(['All', 'A', 'B', 'Applied', 'Referred'] as Filter[]).map((item) => <button key={item} className={`filter ${filter === item ? 'active' : ''}`} onClick={() => { setFilter(item); setExpandedId(null); }}>{item === 'A' ? 'Tier A' : item === 'B' ? 'Tier B' : item}{item === 'All' && <span className="mono"> {visibleJobs.length}</span>}</button>)}</div></div>
      {lead ? <><LeadJob job={lead} saved={Boolean(jobMeta[lead.id]?.saved)} onCopy={copy} onStatus={setStatus} onSave={toggleSaved} onSnooze={snooze} /><LayoutGroup><div className="job-list">{queuedJobs.map((job) => <JobRow key={job.id} job={job} saved={Boolean(jobMeta[job.id]?.saved)} rank={jobState.indexOf(job) + 1} expanded={expandedId === job.id} onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)} onCopy={copy} onStatus={setStatus} onSave={toggleSaved} onSnooze={snooze} reducedMotion={reducedMotion} />)}</div></LayoutGroup></> : <div className="empty">Nothing new today.</div>}
    </motion.section> : <motion.section key="outreach" className="view active" {...motionProps}><div className="section-head"><h2>Cold-email batch</h2><p className="intro-copy compact">{outreachContacts.filter((contact) => contact.emailInferred).length} inferred emails are ready to review in Gmail before sending.</p></div><div className="outreach-list">{outreachContacts.map((contact) => <OutreachRow key={contact.id} contact={contact} onCopy={copy}/>)}</div></motion.section>}</AnimatePresence>
    <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
  </main>;
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="stat"><div className="stat-value mono">{value}</div><div className="stat-label">{label}</div></div>; }

function postedLabel(job: Job) { return job.postedDaysAgo === 0 ? 'posted today' : `posted ${job.postedDaysAgo} day${job.postedDaysAgo > 1 ? 's' : ''} ago`; }
function rankReason(job: Job) { return job.tier === 'A' ? `${job.postedDaysAgo === 0 ? 'Fresh today' : postedLabel(job)} · ${job.location.split(' · ')[0]} · direct stack match` : 'Apply-first role · relevant backend scope'; }
function contactsSearchLink(job: Job) {
  // Without the parentheses, LinkedIn treats generic title terms after OR as independent matches.
  const query = `"${job.company}" AND ("engineering manager" OR "tech lead" OR recruiter)`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

function LeadJob({ job, saved, onCopy, onStatus, onSave, onSnooze }: { job: Job; saved: boolean; onCopy: (text: string) => void; onStatus: (id: string, status: Job['status']) => void; onSave: (id: string) => void; onSnooze: (id: string) => void }) { return <article className={`lead tier-${job.tier.toLowerCase()}`}><div><div className="lead-kicker">Today’s lead · Tier {job.tier}</div><h2>{job.role}</h2><div className="company">{job.company}</div><div className="facts lead-facts"><span>{job.location}</span><span>{job.experience}</span><span>{job.salary}</span><span>{postedLabel(job)}</span></div></div><div className="lead-why"><p>{job.whyFit}</p><div className="facts"><span>{job.companySize}</span><span>{job.jobId}</span></div></div><div className="message"><div className="message-label">Referral message · {job.jobId}</div><p>{job.referralMessage}</p><div className="actions"><button className="btn primary" onClick={() => onCopy(job.referralMessage)}>Copy referral</button><a className="btn" href={contactsSearchLink(job)} target="_blank" rel="noreferrer">Find contacts</a><a className="btn" href={job.applyLink} target="_blank" rel="noreferrer">Apply ↗</a><button className="btn" disabled={job.status === 'Applied'} onClick={() => onStatus(job.id, 'Applied')}>{job.status === 'Applied' ? 'Applied' : 'Mark applied'}</button><button className="btn quiet" onClick={() => onSave(job.id)}>{saved ? 'Saved' : 'Save for later'}</button><button className="text-action" onClick={() => onSnooze(job.id)}>Snooze</button><button className="text-action" onClick={() => onStatus(job.id, 'Rejected')}>Not relevant</button></div></div></article>; }

function JobRow({ job, saved, rank, expanded, onToggle, onCopy, onStatus, onSave, onSnooze, reducedMotion }: { job: Job; saved: boolean; rank: number; expanded: boolean; onToggle: () => void; onCopy: (text: string) => void; onStatus: (id: string, status: Job['status']) => void; onSave: (id: string) => void; onSnooze: (id: string) => void; reducedMotion: boolean | null }) { return <motion.article layout className={`job-row ${expanded ? 'expanded' : ''}`} transition={reducedMotion ? { duration: 0 } : { duration: .25 }}><button className="job-main" aria-expanded={expanded} onClick={onToggle}><span className="rank">{String(rank).padStart(2, '0')}</span><span className="role">{job.role}<small>{job.company}</small>{job.tier === 'A' && <small className="rank-reason">{rankReason(job)}</small>}</span><span className="job-meta">{job.location}<small>{job.experience}</small></span><span className="job-meta">{job.postedDaysAgo === 0 ? 'today' : `${job.postedDaysAgo} day${job.postedDaysAgo > 1 ? 's' : ''} ago`}<small>{saved ? 'Saved' : job.status}</small></span><span className={`tier ${job.tier === 'A' ? 'a' : ''}`}>Tier {job.tier}</span><span className="chevron">⌄</span></button><AnimatePresence initial={false}>{expanded && <motion.div className="job-detail" initial={reducedMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}><p className="job-detail-copy"><strong>Why it fits.</strong> {job.whyFit}</p><div className="message-label">Referral message · {job.jobId}</div><p className="job-detail-copy">{job.referralMessage}</p><div className="actions"><button className="btn primary" onClick={() => onCopy(job.referralMessage)}>Copy referral</button><a className="btn" href={contactsSearchLink(job)} target="_blank" rel="noreferrer">Find contacts</a><a className="btn" href={job.applyLink} target="_blank" rel="noreferrer">Apply ↗</a><button className="btn" disabled={job.status === 'Applied'} onClick={() => onStatus(job.id, 'Applied')}>{job.status === 'Applied' ? 'Applied' : 'Mark applied'}</button><button className="btn quiet" onClick={() => onSave(job.id)}>{saved ? 'Saved' : 'Save for later'}</button><button className="text-action" onClick={() => onSnooze(job.id)}>Snooze</button><button className="text-action" onClick={() => onStatus(job.id, 'Rejected')}>Not relevant</button></div></motion.div>}</AnimatePresence></motion.article>; }

function inferEmail(contact: (typeof outreachContacts)[number]) {
  const localPart = contact.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
  const domain = contact.company.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${localPart}@${domain}.com`;
}

function gmailComposeLink(contact: (typeof outreachContacts)[number], email: string) {
  const subject = `Referral request — ${contact.company}`;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(contact.emailDraft)}`;
}

function OutreachRow({ contact, onCopy }: { contact: (typeof outreachContacts)[number]; onCopy: (text: string) => void }) {
  const email = contact.emailInferred ? inferEmail(contact) : null;
  return <article className="contact"><div><div className="contact-name">{contact.name}</div><div className="contact-meta">{contact.role}<br/>{contact.company}</div></div><div className="contact-meta"><a className="contact-profile" href={contact.profileUrl} target="_blank" rel="noreferrer">View profile</a>{email ? <><span className="inferred-email mono">{email}</span><span className="inferred">Inferred, unverified — verify before sending</span></> : <span className="contact-note">No inferred email</span>}</div><div className="draft">{contact.emailDraft}</div><div className="contact-actions">{email && <a className="btn primary" href={gmailComposeLink(contact, email)} target="_blank" rel="noreferrer">Open Gmail</a>}<button className="btn" onClick={() => onCopy(contact.emailDraft)}>Copy draft</button></div></article>;
}
