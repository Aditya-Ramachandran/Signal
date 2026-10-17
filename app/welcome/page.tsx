'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Welcome() {
  const [notice, setNotice] = useState('');
  return <main className="welcome-shell">
    <header className="welcome-header"><div className="brand"><span className="mark" aria-hidden="true"/><div><div className="wordmark">Signal</div><div className="tagline">Less noise. More signal.</div></div></div><a href="https://github.com/Aditya-Ramachandran/Signal" target="_blank" rel="noreferrer">View on GitHub ↗</a></header>
    <section className="welcome-main"><div><h1>A better morning<br/>job search.</h1><p>Signal finds roles worth your time, turns the best ones into thoughtful outreach, and helps you follow through without losing your place.</p><div className="welcome-capabilities" aria-label="What Signal does"><span>Ranked job discovery</span><span>Referral messages</span><span>Contact research</span><span>Gmail-ready outreach</span><span>Saved &amp; later queues</span></div><div className="welcome-actions"><button className="welcome-google" onClick={() => setNotice('Google sign-in is next — it will sync your private queue across devices.')}>Continue with Google</button><Link className="welcome-guest" href="/?demo=1">Try the guided demo</Link></div>{notice && <p className="welcome-notice" role="status">{notice}</p>}<p className="welcome-footnote">Guest mode uses sample roles and saves progress only on this device.</p></div><aside className="welcome-steps"><h2>Built for the whole loop.</h2><div><span>Jobs</span><strong>Find roles worth your time</strong><p>Fresh backend roles are ranked with fit notes, salary, experience, and a direct application path.</p></div><div><span>Outreach</span><strong>Turn interest into a real note</strong><p>Find the right person, personalize a referral message, or open an inferred-email draft in Gmail.</p></div><div><span>Momentum</span><strong>Keep your search moving</strong><p>Mark progress, save a role for later, or snooze it until tomorrow morning.</p></div></aside></section>
  </main>;
}
