'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function SunIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>; }
function MoonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z"/></svg>; }

export default function Welcome() {
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => { if (window.localStorage.getItem('signal-theme') === 'dark') setTheme('dark'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('signal-theme', theme); }, [theme]);
  return <main className="welcome-shell">
    <header className="welcome-header"><div className="brand"><span className="mark" aria-hidden="true"/><div><div className="wordmark">Signal</div><div className="tagline">Less noise. More signal.</div></div></div><div className="welcome-header-actions"><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <SunIcon/> : <MoonIcon/>}<span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span></button><a href="https://github.com/Aditya-Ramachandran/Signal" target="_blank" rel="noreferrer">View on GitHub ↗</a></div></header>
    <section className="welcome-main"><div><h1>A better morning<br/>job search.</h1><p>Signal finds roles worth your time, turns the best ones into thoughtful outreach, and helps you follow through without losing your place.</p><div className="welcome-capabilities" aria-label="What Signal does"><span>Ranked job discovery</span><span>Referral messages</span><span>Contact research</span><span>Gmail-ready outreach</span><span>Saved &amp; later queues</span></div><div className="welcome-actions"><button className="welcome-google" onClick={() => setNotice('Google sign-in is next — it will sync your private queue across devices.')}>Continue with Google</button><Link className="welcome-guest" href="/?demo=1">Try the guided demo</Link></div>{notice && <p className="welcome-notice" role="status">{notice}</p>}<p className="welcome-footnote">Guest mode uses sample roles and saves progress only on this device.</p></div><aside className="welcome-steps"><h2>Built for the whole loop.</h2><div><span>Jobs</span><strong>Find roles worth your time</strong><p>Fresh backend roles are ranked with fit notes, salary, experience, and a direct application path.</p></div><div><span>Outreach</span><strong>Turn interest into a real note</strong><p>Find the right person, personalize a referral message, or open an inferred-email draft in Gmail.</p></div><div><span>Momentum</span><strong>Keep your search moving</strong><p>Mark progress, save a role for later, or snooze it until tomorrow morning.</p></div></aside></section>
  </main>;
}
