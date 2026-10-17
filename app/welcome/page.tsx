'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import SignalFooter from '../components/SignalFooter';

type Screen = 'home' | 'sign-in' | 'setup';
type AuthState = 'checking' | 'signed-out' | 'allowed' | 'denied' | 'error';
type WaitlistState = 'idle' | 'pending' | 'submitting' | 'error';

function GoogleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.34 2.98-7.37Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.4l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.42 13.92A6.02 6.02 0 0 1 6.1 12c0-.67.12-1.31.32-1.92v-2.6H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.52l3.34-2.6Z"/><path fill="#EA4335" d="M12 5.96c1.45 0 2.75.5 3.77 1.48l2.82-2.82C16.95 3.1 14.7 2 12 2a10 10 0 0 0-8.92 5.48l3.34 2.6C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>; }

function Header({ theme, onTheme, onHome }: { theme: 'light' | 'dark'; onTheme: () => void; onHome: () => void }) {
  return <header className="welcome-header"><button className="brand brand-button" onClick={onHome} aria-label="Return to Signal welcome"><span className="mark" aria-hidden="true"/><span><span className="wordmark">Signal</span><span className="tagline">Less noise. More signal.</span></span></button><div className="welcome-header-actions"><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={onTheme}><span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span></button><a href="https://github.com/Aditya-Ramachandran/Signal" target="_blank" rel="noreferrer">View on GitHub ↗</a></div></header>;
}

export default function Welcome() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [screen, setScreen] = useState<Screen>('home');
  const [setupStep, setSetupStep] = useState(1);
  const [notice, setNotice] = useState('');
  const [roles, setRoles] = useState('Backend engineer');
  const [locations, setLocations] = useState('Bengaluru, Hyderabad, Pune, India remote');
  const [endpoint, setEndpoint] = useState('');
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountUserId, setAccountUserId] = useState('');
  const [waitlistState, setWaitlistState] = useState<WaitlistState>('idle');
  const endpointLooksValid = /^https:\/\/.+/.test(endpoint.trim());

  useEffect(() => { if (window.localStorage.getItem('signal-theme') === 'dark') setTheme('dark'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('signal-theme', theme); }, [theme]);
  useEffect(() => {
    const client = supabase;
    if (!client) { setAuthState('error'); return; }
    const applySession = async (session: Session | null) => {
      if (!session?.user.email) { setAccountEmail(''); setAccountUserId(''); setWaitlistState('idle'); setAuthState('signed-out'); return; }
      const email = session.user.email.toLowerCase();
      setAccountEmail(email);
      setAccountUserId(session.user.id);
      const { data, error } = await client.from('allowed_users').select('email').eq('email', email).maybeSingle();
      if (error) { setAuthState('error'); return; }
      if (data) { if (new URLSearchParams(window.location.search).has('setup')) { setSetupStep(1); setScreen('setup'); } setAuthState('allowed'); return; }
      const request = await client.from('waitlist_requests').select('user_id').eq('user_id', session.user.id).maybeSingle();
      setWaitlistState(request.error ? 'error' : request.data ? 'pending' : 'idle');
      setAuthState('denied');
    };
    void client.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { void applySession(session); });
    return () => subscription.unsubscribe();
  }, []);
  const goHome = () => { setScreen('home'); setSetupStep(1); setNotice(''); };
  const signIn = async () => {
    if (!supabase) { setNotice('Supabase is not configured for this build yet.'); return; }
    const basePath = window.location.hostname.endsWith('github.io') ? '/Signal/' : '/';
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${basePath}` } });
    if (error) setNotice(`Could not start Google sign-in: ${error.message}`);
  };
  const signOut = async () => { await supabase?.auth.signOut(); setAccountEmail(''); setAccountUserId(''); setWaitlistState('idle'); setAuthState('signed-out'); goHome(); };
  const openWorkspace = () => { const basePath = window.location.hostname.endsWith('github.io') ? '/Signal/' : '/'; window.location.assign(`${basePath}?app=1`); };
  const joinWaitlist = async () => {
    if (!supabase || !accountUserId || !accountEmail) return;
    setWaitlistState('submitting');
    const { error } = await supabase.from('waitlist_requests').insert({ user_id: accountUserId, email: accountEmail });
    setWaitlistState(error ? 'error' : 'pending');
  };
  const finishSetup = async () => {
    if (!supabase || !accountUserId) { setNotice('Sign in with an invited Google account to save this workspace.'); return; }
    const { error } = await supabase.from('user_settings').upsert({ user_id: accountUserId, target_roles: roles.trim(), preferred_locations: locations.trim(), jobs_feed_url: endpoint.trim(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) { setNotice('We could not save this workspace. Check the URL and try again.'); return; }
    openWorkspace();
  };

  return <main className="welcome-shell">
    <Header theme={theme} onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} onHome={goHome}/>
    {authState === 'allowed' ? (screen === 'setup' ? <SetupScreen step={setupStep} roles={roles} locations={locations} endpoint={endpoint} endpointLooksValid={endpointLooksValid} notice={notice} onRoles={setRoles} onLocations={setLocations} onEndpoint={(value) => { setEndpoint(value); setNotice(''); }} onNext={() => { if (setupStep === 2 && !endpointLooksValid) { setNotice('Paste the public read-only URL from your Apps Script bridge to continue.'); return; } setNotice(''); setSetupStep(Math.min(setupStep + 1, 3)); }} onBack={() => setupStep === 1 ? setScreen('home') : setSetupStep(setupStep - 1)} onFinish={finishSetup} /> : <SignedInScreen email={accountEmail} onOpen={openWorkspace} onSetup={() => { setNotice(''); setSetupStep(1); setScreen('setup'); }} onSignOut={signOut}/>) : authState === 'denied' ? <DeniedScreen email={accountEmail} state={waitlistState} onJoin={joinWaitlist} onSignOut={signOut}/> : <>{screen === 'home' && <HomeScreen onSignIn={() => setScreen('sign-in')}/>} {screen === 'sign-in' && <SignInScreen notice={notice} configured={isSupabaseConfigured} onGoogle={signIn} onPreview={() => { setNotice(''); setScreen('setup'); }}/>} {screen === 'setup' && <SetupScreen step={setupStep} roles={roles} locations={locations} endpoint={endpoint} endpointLooksValid={endpointLooksValid} notice={notice} onRoles={setRoles} onLocations={setLocations} onEndpoint={(value) => { setEndpoint(value); setNotice(''); }} onNext={() => { if (setupStep === 2 && !endpointLooksValid) { setNotice('Paste the public read-only URL from your Apps Script bridge to continue.'); return; } setNotice(''); setSetupStep(Math.min(setupStep + 1, 3)); }} onBack={() => setupStep === 1 ? setScreen('sign-in') : setSetupStep(setupStep - 1)} onFinish={() => setNotice('Setup preview complete. Sign in with Google after Supabase is connected to save this workspace.')} />}</>}
    <SignalFooter/>
  </main>;
}

function HomeScreen({ onSignIn }: { onSignIn: () => void }) {
  return <section className="welcome-main"><div><h1>A better morning<br/>job search.</h1><p>Signal finds roles worth your time, turns the best ones into thoughtful outreach, and helps you follow through without losing your place.</p><div className="welcome-capabilities" aria-label="What Signal does"><span>Ranked job discovery</span><span>Referral messages</span><span>Contact research</span><span>Gmail-ready outreach</span><span>Saved &amp; later queues</span></div><div className="welcome-actions"><button className="welcome-google" onClick={onSignIn}><GoogleIcon/>Continue with Google</button><Link className="welcome-guest" href="/?demo=1">Try the guided demo</Link></div><p className="welcome-footnote">Guest mode uses sample roles and saves progress only on this device.</p></div><SignalRelayPanel/></section>;
}

function SignalRelayPanel() {
  const panelRef = useRef<HTMLElement>(null);
  const stageRefs = useRef<Array<HTMLElement | null>>([]);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .35 });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(query.matches); update(); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => {
    const panel = panelRef.current;
    const stage = stageRefs.current[activeStage];
    if (!panel || !stage) return;
    const placeRelay = () => {
      const panelBox = panel.getBoundingClientRect();
      const labelBox = stage.querySelector('.relay-stage-label')?.getBoundingClientRect();
      if (!labelBox) return;
      setPosition({ x: labelBox.left - panelBox.left + labelBox.width / 2, y: labelBox.top - panelBox.top + labelBox.height / 2 });
    };
    placeRelay();
    window.addEventListener('resize', placeRelay);
    return () => window.removeEventListener('resize', placeRelay);
  }, [activeStage]);
  useEffect(() => {
    if (!inView || reducedMotion) { setActiveStage(0); return; }
    let interval = window.setInterval(() => setActiveStage((current) => (current + 1) % 3), 1700);
    const onVisibility = () => { window.clearInterval(interval); if (!document.hidden) interval = window.setInterval(() => setActiveStage((current) => (current + 1) % 3), 1700); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, [inView, reducedMotion]);
  const stages = [['Jobs', 'Find roles worth your time', 'Fresh backend roles are ranked with fit notes, salary, experience, and a direct application path.'], ['Outreach', 'Turn interest into a real note', 'Find the right person, personalize a referral message, or open an inferred-email draft in Gmail.'], ['Momentum', 'Keep your search moving', 'Mark progress, save a role for later, or snooze it until tomorrow morning.']];
  return <aside ref={panelRef} className="welcome-steps relay-panel"><span className="relay-track" aria-hidden="true"/><span className="relay-marker" aria-hidden="true" style={{ transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%)` }}/><h2>Built for the whole loop.</h2>{stages.map(([label, title, copy], index) => <div className={`relay-stage ${activeStage === index ? 'is-active' : ''}`} ref={(element) => { stageRefs.current[index] = element; }} key={label}><span className="relay-stage-label">{label}</span><div><strong>{title}</strong><p>{copy}</p></div></div>)}</aside>;
}

function SignInScreen({ notice, configured, onGoogle }: { notice: string; configured: boolean; onGoogle: () => void; onPreview?: () => void }) {
  return <section className="account-flow"><div className="account-copy"><h1>Your Signal stays yours.</h1><p>Sign in to keep a private queue, connect your own pipeline, and pick up your job search from any device.</p><p className="account-detail">Access is by invitation. Your Google identity opens your workspace; it never gives Signal access to your Gmail or Sheets.</p></div><div className="account-panel"><h2>Sign in to your workspace</h2><button className="welcome-google google-auth" onClick={onGoogle} disabled={!configured}><GoogleIcon/>Continue with Google</button>{!configured && <p className="welcome-notice" role="status">Supabase configuration is not available in this build.</p>}{notice && <p className="welcome-notice" role="status">{notice}</p>}<p className="account-help">Want to explore first? <Link href="/?demo=1">Open the guided demo.</Link><br/><Link href="/guide">Read the self-hosted setup guide</Link></p></div></section>;
}

function SignedInScreen({ email, onOpen, onSetup, onSignOut }: { email: string; onOpen: () => void; onSetup: () => void; onSignOut: () => void }) { return <section className="account-flow"><div className="account-copy"><h1>Your workspace is yours.</h1><p>You are signed in as {email}. Your jobs feed and job-search progress are private to this Google account.</p></div><div className="account-panel"><h2>Welcome back</h2><button className="welcome-google google-auth" onClick={onOpen}>Open Signal</button><button className="welcome-guest preview-button" onClick={onSetup}>Connect or edit jobs feed</button><button className="text-action account-signout" onClick={onSignOut}>Sign out</button></div></section>; }
function DeniedScreen({ email, state, onJoin, onSignOut }: { email: string; state: WaitlistState; onJoin: () => void; onSignOut: () => void }) { const pending = state === 'pending'; return <section className="account-flow"><div className="account-copy"><h1>{pending ? 'You’re on the early list.' : 'Signal is opening gradually.'}</h1><p>{pending ? <>We’ve saved <strong>{email}</strong> as the Google account to invite.</> : <>You’re signed in as <strong>{email}</strong>. Join the early list and we’ll know which account to approve when Signal opens up.</>}</p></div><div className="account-panel waitlist-panel"><h2>{pending ? 'Request received' : 'Get early access'}</h2><p className="account-help">{pending ? 'Your request is with the Signal owner. This account will work once you’re invited.' : 'No extra form, no password, and no inbox permissions. Just your verified Google account.'}</p>{pending ? <><span className="waitlist-confirmation">On the early list</span><div className="waitlist-demo"><span>Want to see what you’re waiting for?</span><Link className="welcome-guest" href="/?demo=1">Explore the guided demo</Link></div></> : <button className="welcome-google google-auth" onClick={onJoin} disabled={state === 'submitting'}>{state === 'submitting' ? 'Joining…' : 'Join the waitlist'}</button>}{state === 'error' && <p className="welcome-notice" role="status">We couldn’t add you just now. Please try again.</p>}<button className="text-action account-signout" onClick={onSignOut}>Use another Google account</button></div></section>; }

type SetupProps = { step: number; roles: string; locations: string; endpoint: string; endpointLooksValid: boolean; notice: string; onRoles: (value: string) => void; onLocations: (value: string) => void; onEndpoint: (value: string) => void; onNext: () => void; onBack: () => void; onFinish: () => void; };
function SetupScreen({ step, roles, locations, endpoint, endpointLooksValid, notice, onRoles, onLocations, onEndpoint, onNext, onBack, onFinish }: SetupProps) {
  const [isCheckingFeed, setIsCheckingFeed] = useState(false);
  const [validationNotice, setValidationNotice] = useState('');
  const heading = step === 1 ? 'Tune your daily signal.' : step === 2 ? 'Connect your own pipeline.' : 'Ready for your first queue.';
  const description = step === 1 ? 'These preferences guide your own job pipeline. You can refine them anytime.' : step === 2 ? 'Signal reads a public, read-only jobs feed from the pipeline you run. Your secrets stay in your own GitHub repository and Google account.' : 'Review your settings, then save them to this Google account.';
  const continueSetup = async () => {
    if (step !== 2 || !endpointLooksValid) { onNext(); return; }
    setIsCheckingFeed(true); setValidationNotice('');
    try {
      const response = await fetch(endpoint.trim(), { cache: 'no-store' });
      const payload = await response.json() as { ok?: boolean; jobs?: unknown[] };
      if (!response.ok || !payload.ok || !Array.isArray(payload.jobs)) throw new Error('Invalid jobs feed');
      onNext();
    } catch {
      setValidationNotice('We couldn’t read jobs from this URL. Confirm it ends in /exec, is deployed, and returns the Signal jobs feed.');
    } finally { setIsCheckingFeed(false); }
  };
  const activeNotice = validationNotice || notice;
  return <section className="setup-flow"><div className="setup-heading"><p className="setup-progress">Setup {step} of 3</p><h1>{heading}</h1><p>{description}</p></div><div className="setup-workspace"><nav className="setup-nav" aria-label="Setup steps"><span className={step >= 1 ? 'current' : ''}>Profile</span><span className={step >= 2 ? 'current' : ''}>Pipeline</span><span className={step >= 3 ? 'current' : ''}>Ready</span></nav>{step === 1 && <div className="setup-fields"><label>Roles you want<input value={roles} onChange={(event) => onRoles(event.target.value)} autoComplete="off"/></label><label>Preferred locations<input value={locations} onChange={(event) => onLocations(event.target.value)} autoComplete="off"/></label><p className="field-note">Example: Backend engineer · Bengaluru, Hyderabad, Pune, India remote</p></div>}{step === 2 && <div className="setup-fields"><label>Public jobs-feed URL<input value={endpoint} onChange={(event) => { setValidationNotice(''); onEndpoint(event.target.value); }} placeholder="https://script.google.com/macros/s/.../exec" inputMode="url" autoComplete="url"/></label><p className="field-note">We’ll check this URL before saving. Paste only the public read-only <code>/exec</code> URL from your Apps Script bridge—never a Sheet ID, GitHub token, or bot secret.</p><Link className="setup-guide" href="/guide">Read the setup guide</Link></div>}{step === 3 && <div className="connection-summary"><div><span>Role focus</span><strong>{roles || 'Not set'}</strong></div><div><span>Locations</span><strong>{locations || 'Not set'}</strong></div><div><span>Tracker</span><strong>{endpoint ? 'Checked and ready to save' : 'Add this in the previous step'}</strong></div><p>Signal will save this private workspace configuration. Your feed will be checked again when you open Signal.</p></div>}{activeNotice && <p className="welcome-notice setup-notice" role="status">{activeNotice}</p>}<div className="setup-actions"><button className="back-button" onClick={onBack}>Back</button>{step < 3 ? <button className="welcome-google" onClick={continueSetup} disabled={isCheckingFeed}>{isCheckingFeed ? 'Checking feed…' : 'Continue'}</button> : <button className="welcome-google" onClick={onFinish}>Save workspace</button>}</div></div></section>;
}
