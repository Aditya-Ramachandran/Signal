'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import SignalFooter from '../components/SignalFooter';
import SignalMark from '../components/SignalMark';
import { supabase } from '../../lib/supabase';
import { classifyApplicationRoute, createApplicationRequestDraft, isHttpUrl, type ApplicationProfile, type ApplicationStatus, type JobApplicationTarget, type ResumeRecord } from '../../lib/signalApply';
import {
  approveApplicationPreparation,
  createApplicationDraft,
  getApplicationProfile,
  getApplicationRunnerHealth,
  getApplicationRequests,
  getResumes,
  saveApplicationProfile,
  uploadApplicationResume,
  type ApplicationRequestRecord,
  type ApplicationRunnerHealth,
} from '../../lib/signalApplyRepository';

type LoadState = 'loading' | 'ready' | 'signed-out' | 'error';
type RouteState = 'agent-ready' | 'manual-pack' | 'unsupported';

function targetFromSearch(): JobApplicationTarget | null {
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get('jobId')?.trim();
  const company = params.get('company')?.trim();
  const role = params.get('role')?.trim();
  const applicationUrl = params.get('url')?.trim();
  const source = params.get('source');
  if (!jobId || !company || !role || !applicationUrl || !isHttpUrl(applicationUrl)) return null;
  return {
    jobId,
    company,
    role,
    applicationUrl,
    listingSource: source === 'linkedin' || source === 'indeed' || source === 'workday' ? source : 'external',
  };
}

function blankProfile(userId: string, email = ''): ApplicationProfile {
  return {
    userId,
    version: 1,
    contact: { fullName: '', email, phone: '', location: '' },
    links: { linkedin: '', github: '', portfolio: '' },
    experience: [],
    education: [],
    skills: [],
    commonAnswers: {},
  };
}

function routeState(target: JobApplicationTarget | null): RouteState {
  if (!target) return 'unsupported';
  const route = classifyApplicationRoute(target.applicationUrl);
  return route.platform === 'workday' && route.mode === 'agent'
    ? 'agent-ready'
    : route.destinationHost
      ? 'manual-pack'
      : 'unsupported';
}

function statusCopy(status: ApplicationStatus): string {
  const labels: Record<ApplicationStatus, string> = {
    draft: 'Draft', approved_to_prepare: 'Preparation approved', waiting_for_runner: 'Preparation queued', running: 'Preparing securely', needs_you: 'Needs your review', ready_to_submit: 'Ready for your final approval', submit_approved: 'Final approval given', submitted: 'Application marked sent', failed: 'Needs attention', cancelled: 'Cancelled',
  };
  return labels[status];
}

export default function ApplyPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [target, setTarget] = useState<JobApplicationTarget | null>(null);
  const [profile, setProfile] = useState<ApplicationProfile | null>(null);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [requests, setRequests] = useState<ApplicationRequestRecord[]>([]);
  const [runnerHealth, setRunnerHealth] = useState<ApplicationRunnerHealth | null>(null);
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const state = routeState(target);
  const selectedResume = resumes.find((resume) => resume.id === selectedResumeId) ?? null;
  const existingForTarget = useMemo(() => target ? requests.find((request) => request.jobId === target.jobId && !['failed', 'cancelled'].includes(request.status)) : undefined, [requests, target]);
  const missingProfileFields = profile ? [
    !profile.contact.fullName?.trim() ? 'full name' : '',
    !profile.contact.email?.trim() ? 'email' : '',
    !profile.contact.phone?.trim() ? 'phone number' : '',
  ].filter(Boolean) : [];
  const runnerStatus = runnerHealth?.state === 'online' ? 'Private runner online · rehearsal only' : runnerHealth?.state === 'working' ? 'Private runner preparing a rehearsal' : runnerHealth?.state === 'degraded' ? 'Private runner needs attention' : runnerHealth?.state === 'offline' ? 'Private runner offline' : '';

  const refreshWorkspace = async (id: string) => {
    const [savedProfile, savedResumes, savedRequests, savedRunnerHealth] = await Promise.all([getApplicationProfile(id), getResumes(id), getApplicationRequests(), getApplicationRunnerHealth()]);
    setProfile(savedProfile ?? blankProfile(id));
    setResumes(savedResumes);
    setSelectedResumeId((current) => current || savedResumes.find((resume) => resume.isActive)?.id || savedResumes[0]?.id || '');
    setRequests(savedRequests);
    setRunnerHealth(savedRunnerHealth);
  };

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('signal-theme');
    if (savedTheme === 'dark') setTheme('dark');
    setTarget(targetFromSearch());
    if (!supabase) { setLoadState('error'); setMessage('Supabase is not configured for this Signal workspace.'); return; }
    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) { setLoadState('signed-out'); return; }
      setUserId(data.user.id);
      try {
        await refreshWorkspace(data.user.id);
        if (!cancelled) setLoadState('ready');
      } catch (workspaceError) {
        if (!cancelled) { setLoadState('error'); setMessage(workspaceError instanceof Error ? workspaceError.message : 'Your application workspace could not load.'); }
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('signal-theme', theme); }, [theme]);

  const updateContact = (key: keyof ApplicationProfile['contact'], value: string) => {
    setProfile((current) => current ? { ...current, contact: { ...current.contact, [key]: value } } : current);
  };
  const updateLink = (key: keyof ApplicationProfile['links'], value: string) => {
    setProfile((current) => current ? { ...current, links: { ...current.links, [key]: value } } : current);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setMessage('');
    try {
      const next = { ...profile, version: profile.updatedAt ? profile.version + 1 : profile.version };
      const saved = await saveApplicationProfile(next);
      setProfile(saved);
      setMessage('Profile saved. It will be frozen only when you approve a specific application.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Profile could not be saved.');
    } finally {
      setSavingProfile(false);
    }
  };

  const addResume = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setUploadingResume(true);
    setMessage('');
    try {
      const resume = await uploadApplicationResume(userId, file);
      const nextResumes = [resume, ...resumes.map((item) => ({ ...item, isActive: false }))];
      setResumes(nextResumes);
      setSelectedResumeId(resume.id);
      setMessage(`${resume.fileName} is selected for your next application.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Resume upload failed.');
    } finally {
      setUploadingResume(false);
    }
  };

  const createRequest = async () => {
    if (!target || !profile || !userId || existingForTarget) return;
    setCreatingRequest(true);
    setMessage('');
    try {
      const draft = createApplicationRequestDraft(target, profile, selectedResume);
      if (!draft.ok) throw new Error(draft.errors.join(' '));
      const requestId = await createApplicationDraft(draft.value);
      if (state === 'agent-ready') {
        await approveApplicationPreparation(requestId);
        setMessage('Rehearsal approved. Signal will test only your reviewed safe fields; it will not open or submit the employer application yet.');
      } else {
        setMessage('Manual application pack saved. Open the official application when you are ready to complete it yourself.');
      }
      await refreshWorkspace(userId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This application request could not be created.');
    } finally {
      setCreatingRequest(false);
    }
  };

  return <main className="apply-shell">
    <header className="apply-header">
      <Link className="brand" href="/"><SignalMark/><span><span className="wordmark">Signal</span><span className="tagline">Less noise. More signal.</span></span></Link>
      <div className="apply-header-actions"><Link href="/" className="text-action">Back to queue</Link><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span></button></div>
    </header>

    {loadState === 'loading' && <ApplySkeleton/>}
    {loadState === 'signed-out' && <section className="apply-empty"><h1>Sign in to prepare an application.</h1><p>Signal keeps your profile, resume, and application history inside your private workspace.</p><Link className="btn primary" href="/">Go to Signal</Link></section>}
    {loadState === 'error' && <section className="apply-empty"><h1>Your Apply workspace needs attention.</h1><p>{message}</p><Link className="btn primary" href="/">Back to Signal</Link></section>}
    {loadState === 'ready' && profile && <>
      <section className="apply-intro">
        <div><h1>{target ? 'Prepare this application.' : 'Prepare the right application.'}</h1><p>{target ? 'Review this role, choose your materials, and approve a safe rehearsal. You keep every final decision.' : 'Choose a role from your morning queue, then prepare one clear next step.'}</p></div>
        <div><p className="apply-safety">No auto-submit. No CAPTCHA bypass. Sensitive answers stay with you.</p>{runnerStatus && <p className={`apply-runner-health ${runnerHealth?.state}`} role="status"><span aria-hidden="true"/>{runnerStatus}</p>}</div>
      </section>

      {!target ? <section className="apply-empty"><h2>Choose a role first.</h2><p>From your morning queue, open a role and choose <strong>Prepare application</strong>. Signal will bring its application link and context here.</p><Link className="btn primary" href="/">Open your queue</Link></section> : <>
        <section className={`apply-target ${state}`}>
          <div><span className="apply-state">{state === 'agent-ready' ? 'Workday rehearsal ready' : state === 'manual-pack' ? 'Prepare your details' : 'Unsupported application link'}</span><h2>{target.role}</h2><p>{target.company}</p></div>
          <div className="apply-target-detail"><strong>{state === 'agent-ready' ? 'Approve a safe rehearsal' : state === 'manual-pack' ? 'You will complete this application yourself' : 'Needs a valid application link'}</strong><span>{state === 'agent-ready' ? 'Signal tests only your reviewed safe fields in its rehearsal form. It does not visit or submit this employer application yet.' : state === 'manual-pack' ? 'Signal saves your selected details so you can complete the official application yourself.' : 'Return to the queue and use a role with a valid employer application URL.'}</span><a href={target.applicationUrl} target="_blank" rel="noreferrer">View official application ↗</a></div>
        </section>

        {existingForTarget ? <section className="apply-existing"><span className="apply-state">{statusCopy(existingForTarget.status)}</span><h2>This application is already being tracked.</h2><p>{existingForTarget.status === 'approved_to_prepare' ? 'Your approval is saved. Signal will show preparation progress here when it begins.' : 'Review this role’s saved status below. Signal will not create a duplicate request.'}</p></section> : <section className="apply-approval">
          <div className="apply-approval-copy"><h2>{state === 'agent-ready' ? 'Approve rehearsal' : 'Save your details'}</h2><p>{missingProfileFields.length ? `Add your ${missingProfileFields.join(', ')} in Application materials below before continuing.` : state === 'agent-ready' ? 'This freezes the reviewed profile and selected resume for a fictional safety rehearsal. It does not open or submit the employer application.' : 'This preserves the selected details for this role; you will complete the official application yourself.'}</p></div>
          <div className="apply-choice"><label htmlFor="resume-select">Resume for this role <span>optional</span></label><select id="resume-select" value={selectedResumeId} onChange={(event) => setSelectedResumeId(event.target.value)}><option value="">No resume attached</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.fileName}{resume.isActive ? ' · active' : ''}</option>)}</select><button className="btn primary" disabled={state === 'unsupported' || creatingRequest || Boolean(missingProfileFields.length)} onClick={createRequest}>{creatingRequest ? 'Saving…' : state === 'agent-ready' ? 'Approve rehearsal' : 'Save details'}</button></div>
        </section>}
      <details className="apply-materials" open={Boolean(missingProfileFields.length)}>
        <summary>Contact details and resume <span>{missingProfileFields.length ? `Needs ${missingProfileFields.join(', ')}` : 'Ready to review'}</span></summary>
        <div className="apply-profile-section">
        <div className="apply-section-heading"><h2>Contact details for this role</h2><p>Signal stores only the basics currently used in a preparation packet. Sensitive, legal, and demographic answers stay with you.</p></div>
        <form className="apply-profile-form" onSubmit={saveProfile}>
          <label>Full name<input value={profile.contact.fullName ?? ''} onChange={(event) => updateContact('fullName', event.target.value)} autoComplete="name"/></label>
          <label>Email<input type="email" value={profile.contact.email ?? ''} onChange={(event) => updateContact('email', event.target.value)} autoComplete="email"/></label>
          <label>Phone<input type="tel" value={profile.contact.phone ?? ''} onChange={(event) => updateContact('phone', event.target.value)} autoComplete="tel"/></label>
          <label>Location <span>optional</span><input value={profile.contact.location ?? ''} onChange={(event) => updateContact('location', event.target.value)} autoComplete="address-level2"/></label>
          <label>LinkedIn <span>optional</span><input type="url" value={profile.links.linkedin ?? ''} onChange={(event) => updateLink('linkedin', event.target.value)} placeholder="https://linkedin.com/in/..."/></label>
          <label>Portfolio or GitHub <span>optional</span><input type="url" value={profile.links.portfolio || profile.links.github || ''} onChange={(event) => updateLink('portfolio', event.target.value)} placeholder="https://..."/></label>
          <div className="apply-form-actions"><button className="btn" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>{profile.updatedAt && <span className="apply-saved">Profile version {profile.version} saved</span>}</div>
        </form>
        </div>

      <div className="apply-resumes">
        <div className="apply-section-heading"><h2>Resume options</h2><p>Upload a PDF, DOC, or DOCX up to 10 MB. You choose one only when a role needs it.</p></div>
        <label className="apply-upload"><span>{uploadingResume ? 'Uploading resume…' : 'Upload a resume'}</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={uploadingResume} onChange={addResume}/></label>
        {resumes.length ? <ul className="apply-resume-list">{resumes.map((resume) => <li key={resume.id}><span>{resume.fileName}</span>{resume.isActive && <strong>Active</strong>}</li>)}</ul> : <p className="apply-empty-copy">No resume uploaded yet. You can still make a request, but Workday preparation will stop when a resume is required.</p>}
      </div>
      </details>

      {existingForTarget && <details className="apply-materials apply-activity" open><summary>Preparation status <span>{statusCopy(existingForTarget.status)}</span></summary><div className="apply-history" aria-live="polite"><div className="apply-section-heading"><h2>This role’s activity</h2><p>Only this role’s saved status is shown here.</p></div><ul>{[existingForTarget].map((request) => <li key={request.id}><div><span className="apply-state">{statusCopy(request.status)}</span><strong>{request.jobSnapshot.role}</strong><span>{request.jobSnapshot.company} · {request.mode === 'agent' ? 'Prepared with Signal' : 'Prepared details'}</span></div><time dateTime={request.updatedAt}>{new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(request.updatedAt))}</time></li>)}</ul></div></details>}
      </>}
      {message && <div className="apply-toast" role="status">{message}</div>}
    </>}
    <SignalFooter/>
  </main>;
}

function ApplySkeleton() {
  return <section className="apply-skeleton" aria-busy="true" aria-label="Loading your application workspace"><span/><span/><span/><span/></section>;
}
