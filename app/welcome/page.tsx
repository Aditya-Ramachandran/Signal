'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type Screen = 'home' | 'sign-in' | 'setup';
type AuthState = 'checking' | 'signed-out' | 'allowed' | 'denied' | 'error';

function SunIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>; }
function MoonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z"/></svg>; }
function GoogleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.34 2.98-7.37Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.4l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.42 13.92A6.02 6.02 0 0 1 6.1 12c0-.67.12-1.31.32-1.92v-2.6H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.52l3.34-2.6Z"/><path fill="#EA4335" d="M12 5.96c1.45 0 2.75.5 3.77 1.48l2.82-2.82C16.95 3.1 14.7 2 12 2a10 10 0 0 0-8.92 5.48l3.34 2.6C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>; }

function Header({ theme, onTheme, onHome }: { theme: 'light' | 'dark'; onTheme: () => void; onHome: () => void }) {
  return <header className="welcome-header"><button className="brand brand-button" onClick={onHome} aria-label="Return to Signal welcome"><span className="mark" aria-hidden="true"/><span><span className="wordmark">Signal</span><span className="tagline">Less noise. More signal.</span></span></button><div className="welcome-header-actions"><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={onTheme}>{theme === 'dark' ? <SunIcon/> : <MoonIcon/>}<span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span></button><a href="https://github.com/Aditya-Ramachandran/Signal" target="_blank" rel="noreferrer">View on GitHub ↗</a></div></header>;
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
  const endpointLooksValid = /^https:\/\/.+/.test(endpoint.trim());

  useEffect(() => { if (window.localStorage.getItem('signal-theme') === 'dark') setTheme('dark'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('signal-theme', theme); }, [theme]);
  useEffect(() => {
    const client = supabase;
    if (!client) { setAuthState('error'); return; }
    const applySession = async (session: Session | null) => {
      if (!session?.user.email) { setAccountEmail(''); setAuthState('signed-out'); return; }
      const email = session.user.email.toLowerCase();
      setAccountEmail(email);
      const { data, error } = await client.from('allowed_users').select('email').eq('email', email).maybeSingle();
      setAuthState(error ? 'error' : data ? 'allowed' : 'denied');
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
  const signOut = async () => { await supabase?.auth.signOut(); setAccountEmail(''); setAuthState('signed-out'); goHome(); };
  const openWorkspace = () => { const basePath = window.location.hostname.endsWith('github.io') ? '/Signal/' : '/'; window.location.assign(`${basePath}?app=1`); };

  return <main className="welcome-shell">
    <Header theme={theme} onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} onHome={goHome}/>
    {authState === 'allowed' ? <SignedInScreen email={accountEmail} onOpen={openWorkspace} onSignOut={signOut}/> : authState === 'denied' ? <DeniedScreen email={accountEmail} onSignOut={signOut}/> : <>{screen === 'home' && <HomeScreen onSignIn={() => setScreen('sign-in')}/>} {screen === 'sign-in' && <SignInScreen notice={notice} configured={isSupabaseConfigured} onGoogle={signIn} onPreview={() => { setNotice(''); setScreen('setup'); }}/>} {screen === 'setup' && <SetupScreen step={setupStep} roles={roles} locations={locations} endpoint={endpoint} endpointLooksValid={endpointLooksValid} notice={notice} onRoles={setRoles} onLocations={setLocations} onEndpoint={(value) => { setEndpoint(value); setNotice(''); }} onNext={() => { if (setupStep === 2 && !endpointLooksValid) { setNotice('Paste the public read-only URL from your Apps Script bridge to continue.'); return; } setNotice(''); setSetupStep(Math.min(setupStep + 1, 3)); }} onBack={() => setupStep === 1 ? setScreen('sign-in') : setSetupStep(setupStep - 1)} onFinish={() => setNotice('Setup preview complete. Sign in with Google after Supabase is connected to save this workspace.')} />}</>}
  </main>;
}

function HomeScreen({ onSignIn }: { onSignIn: () => void }) {
  return <section className="welcome-main"><div><h1>A better morning<br/>job search.</h1><p>Signal finds roles worth your time, turns the best ones into thoughtful outreach, and helps you follow through without losing your place.</p><div className="welcome-capabilities" aria-label="What Signal does"><span>Ranked job discovery</span><span>Referral messages</span><span>Contact research</span><span>Gmail-ready outreach</span><span>Saved &amp; later queues</span></div><div className="welcome-actions"><button className="welcome-google" onClick={onSignIn}><GoogleIcon/>Continue with Google</button><Link className="welcome-guest" href="/?demo=1">Try the guided demo</Link></div><p className="welcome-footnote">Guest mode uses sample roles and saves progress only on this device.</p></div><aside className="welcome-steps"><h2>Built for the whole loop.</h2><div><span>Jobs</span><strong>Find roles worth your time</strong><p>Fresh backend roles are ranked with fit notes, salary, experience, and a direct application path.</p></div><div><span>Outreach</span><strong>Turn interest into a real note</strong><p>Find the right person, personalize a referral message, or open an inferred-email draft in Gmail.</p></div><div><span>Momentum</span><strong>Keep your search moving</strong><p>Mark progress, save a role for later, or snooze it until tomorrow morning.</p></div></aside></section>;
}

function SignInScreen({ notice, configured, onGoogle, onPreview }: { notice: string; configured: boolean; onGoogle: () => void; onPreview: () => void }) {
  return <section className="account-flow"><div className="account-copy"><h1>Your Signal stays yours.</h1><p>Sign in to keep a private queue, connect your own pipeline, and pick up your job search from any device.</p><p className="account-detail">Access is by invitation. Your Google identity opens your workspace; it never gives Signal access to your Gmail or Sheets.</p></div><div className="account-panel"><h2>Sign in to your workspace</h2><button className="welcome-google google-auth" onClick={onGoogle} disabled={!configured}><GoogleIcon/>Continue with Google</button>{!configured && <p className="welcome-notice" role="status">Supabase configuration is not available in this build.</p>}{notice && <p className="welcome-notice" role="status">{notice}</p>}<div className="account-divider"><span>or</span></div><button className="welcome-guest preview-button" onClick={onPreview}>Preview the connection setup</button><p className="account-help">Want to explore first? <Link href="/?demo=1">Open the guided demo.</Link></p></div></section>;
}

function SignedInScreen({ email, onOpen, onSignOut }: { email: string; onOpen: () => void; onSignOut: () => void }) { return <section className="account-flow"><div className="account-copy"><h1>Your workspace is ready.</h1><p>You are signed in as {email}. Your Signal preferences and job-search progress will belong only to this account.</p></div><div className="account-panel"><h2>Welcome back</h2><button className="welcome-google google-auth" onClick={onOpen}>Open Signal</button><button className="text-action account-signout" onClick={onSignOut}>Sign out</button></div></section>; }
function DeniedScreen({ email, onSignOut }: { email: string; onSignOut: () => void }) { return <section className="account-flow"><div className="account-copy"><h1>This workspace is invite-only.</h1><p>{email} signed in successfully, but it is not on Signal’s approved-user list yet.</p></div><div className="account-panel"><h2>Access needs approval</h2><p className="account-help">Ask the Signal owner to add this exact Google email address to the invite list, then try again.</p><button className="text-action account-signout" onClick={onSignOut}>Use another Google account</button></div></section>; }

type SetupProps = { step: number; roles: string; locations: string; endpoint: string; endpointLooksValid: boolean; notice: string; onRoles: (value: string) => void; onLocations: (value: string) => void; onEndpoint: (value: string) => void; onNext: () => void; onBack: () => void; onFinish: () => void; };
function SetupScreen({ step, roles, locations, endpoint, endpointLooksValid, notice, onRoles, onLocations, onEndpoint, onNext, onBack, onFinish }: SetupProps) {
  return <section className="setup-flow"><div className="setup-heading"><p className="setup-progress">Setup {step} of 3</p><h1>{step === 1 ? 'Tune your daily signal.' : step === 2 ? 'Connect your own pipeline.' : 'Ready for your first queue.'}</h1><p>{step === 1 ? 'These preferences guide your own job pipeline. You can refine them anytime.' : step === 2 ? 'Signal reads a public, read-only jobs feed from the pipeline you run. Your secrets stay in your own GitHub repository and Google account.' : 'Your preferences and tracker endpoint will belong only to your Google account once authentication is connected.'}</p></div><div className="setup-workspace"><nav className="setup-nav" aria-label="Setup steps"><span className={step >= 1 ? 'current' : ''}>Profile</span><span className={step >= 2 ? 'current' : ''}>Pipeline</span><span className={step >= 3 ? 'current' : ''}>Ready</span></nav>{step === 1 && <div className="setup-fields"><label>Roles you want<input value={roles} onChange={(event) => onRoles(event.target.value)} autoComplete="off"/></label><label>Preferred locations<input value={locations} onChange={(event) => onLocations(event.target.value)} autoComplete="off"/></label><p className="field-note">Example: Backend engineer · Bengaluru, Hyderabad, Pune, India remote</p></div>}{step === 2 && <div className="setup-fields"><label>Public jobs-feed URL<input value={endpoint} onChange={(event) => onEndpoint(event.target.value)} placeholder="https://script.google.com/macros/s/.../exec" inputMode="url" autoComplete="url"/></label><p className="field-note">Paste only the public read-only <code>/exec</code> URL from your Apps Script bridge. Never paste a Sheet ID, GitHub token, or bot secret here.</p><a className="setup-guide" href="https://github.com/Aditya-Ramachandran/Signal" target="_blank" rel="noreferrer">Open the self-hosted setup guide ↗</a></div>}{step === 3 && <div className="connection-summary"><div><span>Role focus</span><strong>{roles || 'Not set'}</strong></div><div><span>Locations</span><strong>{locations || 'Not set'}</strong></div><div><span>Tracker</span><strong>{endpoint ? 'Endpoint format ready' : 'Add this in the previous step'}</strong></div><p>When Google sign-in is connected, Signal will validate this endpoint and securely save this configuration to your private workspace.</p></div>}{notice && <p className="welcome-notice setup-notice" role="status">{notice}</p>}<div className="setup-actions"><button className="back-button" onClick={onBack}>Back</button>{step < 3 ? <button className="welcome-google" onClick={onNext}>{step === 2 ? 'Check connection' : 'Continue'}</button> : <button className="welcome-google" onClick={onFinish}>Finish preview</button>}</div></div></section>;
}
