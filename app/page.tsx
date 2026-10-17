'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { jobs as initialJobs, outreachContacts, type Job } from '../lib/sampleData';

type Filter = 'All' | 'A' | 'B' | 'Applied' | 'Referred';
type View = 'today' | 'outreach';

function SunIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>; }
function MoonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z"/></svg>; }

export default function Home() {
  const [activeView, setActiveView] = useState<View>('today');
  const [filter, setFilter] = useState<Filter>('All');
  const [jobState, setJobState] = useState<Job[]>(initialJobs);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toast, setToast] = useState('');
  const reducedMotion = useReducedMotion();
  const briefingDate = '17 Oct 2026';
  const lastRun = '08:12';

  useEffect(() => { const saved = window.localStorage.getItem('signal-theme'); if (saved === 'dark') setTheme('dark'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('signal-theme', theme); }, [theme]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2200); return () => window.clearTimeout(timer); }, [toast]);

  const filteredJobs = useMemo(() => jobState.filter((job) => filter === 'All' || (filter === 'A' && job.tier === 'A') || (filter === 'B' && job.tier === 'B') || job.status === filter), [filter, jobState]);
  const lead = filteredJobs[0];
  const queuedJobs = lead ? filteredJobs.filter((job) => job.id !== lead.id) : [];
  const setStatus = (id: string, status: Job['status']) => { setJobState((items) => items.map((job) => job.id === id ? { ...job, status } : job)); setToast(`Status updated to ${status}`); };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setToast('Copied to clipboard'); } catch { setToast('Copy unavailable — select the text manually'); } };
  const refresh = () => setToast('Sample queue refreshed locally');
  const motionProps = reducedMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: .45, ease: 'easeOut' as const } };

  return <main className="shell">
    <header className="masthead">
      <div className="brand"><span className="mark" aria-hidden="true"/><div><div className="wordmark">Signal</div><div className="tagline">Less noise. More signal.</div></div></div>
      <div className="mast-actions"><span className="date mono">SAT, 17 OCT 2026</span><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <SunIcon/> : <MoonIcon/>}<span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span></button><button className="refresh" onClick={refresh}>Refresh queue</button></div>
    </header>

    <motion.section className="stats" aria-label="Queue summary" {...(reducedMotion ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: .08, duration: .4 } })}>
      <Stat value={String(jobState.filter((job) => job.dateFound === briefingDate).length)} label="new today"/><Stat value={String(jobState.filter((job) => job.tier === 'A').length)} label="Tier A roles"/><Stat value={lastRun} label="sample run, IST"/>
    </motion.section>

    <nav className="view-tabs" aria-label="Views">{(['today', 'outreach'] as View[]).map((view) => <button key={view} className={`view-tab ${activeView === view ? 'active' : ''}`} onClick={() => setActiveView(view)}>{view === 'today' ? 'Today' : 'Outreach'}</button>)}</nav>

    <AnimatePresence mode="wait">{activeView === 'today' ? <motion.section key="today" className="view active" {...motionProps}>
      <div className="section-head"><h2>Morning queue</h2><div className="filters" role="tablist" aria-label="Filter jobs">{(['All', 'A', 'B', 'Applied', 'Referred'] as Filter[]).map((item) => <button key={item} className={`filter ${filter === item ? 'active' : ''}`} onClick={() => { setFilter(item); setExpandedId(null); }}>{item === 'A' ? 'Tier A' : item === 'B' ? 'Tier B' : item}{item === 'All' && <span className="mono"> {jobState.length}</span>}</button>)}</div></div>
      {lead ? <><LeadJob job={lead} onCopy={copy} /><LayoutGroup><div className="job-list">{queuedJobs.map((job) => <JobRow key={job.id} job={job} rank={jobState.indexOf(job) + 1} expanded={expandedId === job.id} onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)} onCopy={copy} onStatus={setStatus} reducedMotion={reducedMotion} />)}</div></LayoutGroup></> : <div className="empty">Nothing matches this filter.</div>}
    </motion.section> : <motion.section key="outreach" className="view active" {...motionProps}><div className="section-head"><h2>Cold-email batch</h2><p className="intro-copy compact">Four contacts are ready for a thoughtful first note. Review before sending.</p></div><div className="outreach-list">{outreachContacts.map((contact) => <OutreachRow key={contact.id} contact={contact} onCopy={copy}/>)}</div></motion.section>}</AnimatePresence>
    <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
  </main>;
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="stat"><div className="stat-value mono">{value}</div><div className="stat-label">{label}</div></div>; }

function postedLabel(job: Job) { return job.postedDaysAgo === 0 ? 'posted today' : `posted ${job.postedDaysAgo} day${job.postedDaysAgo > 1 ? 's' : ''} ago`; }
function rankReason(job: Job) { return job.tier === 'A' ? `${job.postedDaysAgo === 0 ? 'Fresh today' : postedLabel(job)} · ${job.location.split(' · ')[0]} · direct stack match` : 'Apply-first role · relevant backend scope'; }

function LeadJob({ job, onCopy }: { job: Job; onCopy: (text: string) => void }) { return <article className={`lead tier-${job.tier.toLowerCase()}`}><div><div className="lead-kicker">Today’s lead · Tier {job.tier}</div><h2>{job.role}</h2><div className="company">{job.company}</div><div className="facts lead-facts"><span>{job.location}</span><span>{job.experience}</span><span>{job.salary}</span><span>{postedLabel(job)}</span></div></div><div className="lead-why"><p>{job.whyFit}</p><div className="facts"><span>{job.companySize}</span><span>{job.jobId}</span></div></div><div className="message"><div className="message-label">Referral message</div><p>{job.referralMessage}</p><div className="actions"><button className="btn primary" onClick={() => onCopy(job.referralMessage)}>Copy message</button><a className="btn" href={job.findContactsLink} target="_blank" rel="noreferrer">Find contacts</a><a className="btn" href={job.applyLink} target="_blank" rel="noreferrer">Apply ↗</a></div></div></article>; }

function JobRow({ job, rank, expanded, onToggle, onCopy, onStatus, reducedMotion }: { job: Job; rank: number; expanded: boolean; onToggle: () => void; onCopy: (text: string) => void; onStatus: (id: string, status: Job['status']) => void; reducedMotion: boolean | null }) { return <motion.article layout className={`job-row ${expanded ? 'expanded' : ''}`} transition={reducedMotion ? { duration: 0 } : { duration: .25 }}><button className="job-main" aria-expanded={expanded} onClick={onToggle}><span className="rank">{String(rank).padStart(2, '0')}</span><span className="role">{job.role}<small>{job.company}</small>{job.tier === 'A' && <small className="rank-reason">{rankReason(job)}</small>}</span><span className="job-meta">{job.location}<small>{job.experience}</small></span><span className="job-meta">{job.postedDaysAgo === 0 ? 'today' : `${job.postedDaysAgo} day${job.postedDaysAgo > 1 ? 's' : ''} ago`}<small>{job.status}</small></span><span className={`tier ${job.tier === 'A' ? 'a' : ''}`}>Tier {job.tier}</span><span className="chevron">⌄</span></button><AnimatePresence initial={false}>{expanded && <motion.div className="job-detail" initial={reducedMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}><p className="job-detail-copy"><strong>Why it fits.</strong> {job.whyFit}</p><div className="message-label">Referral message · {job.jobId}</div><p className="job-detail-copy">{job.referralMessage}</p><div className="actions"><button className="btn primary" onClick={() => onCopy(job.referralMessage)}>Copy message</button><a className="btn" href={job.findContactsLink} target="_blank" rel="noreferrer">Find contacts</a><a className="btn" href={job.applyLink} target="_blank" rel="noreferrer">Apply ↗</a><select className="status-select" value={job.status} aria-label={`Update status for ${job.role}`} onClick={(event) => event.stopPropagation()} onChange={(event) => onStatus(job.id, event.target.value as Job['status'])}>{['New', 'Applied', 'Referred', 'Rejected'].map((status) => <option key={status}>{status}</option>)}</select></div></motion.div>}</AnimatePresence></motion.article>; }

function OutreachRow({ contact, onCopy }: { contact: (typeof outreachContacts)[number]; onCopy: (text: string) => void }) { return <article className="contact"><div><div className="contact-name">{contact.name}</div><div className="contact-meta">{contact.role}<br/>{contact.company}</div></div><div className="contact-meta"><a className="contact-profile" href={contact.profileUrl} target="_blank" rel="noreferrer">View profile</a>{contact.emailInferred ? <span className="inferred">Email signal inferred — verify on profile</span> : <span className="contact-note">No email on file</span>}</div><div className="draft">{contact.emailDraft}</div><button className="btn" onClick={() => onCopy(contact.emailDraft)}>Copy draft</button></article>; }
