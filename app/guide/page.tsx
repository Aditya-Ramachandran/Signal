'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SignalFooter from '../components/SignalFooter';
import MobileDesktopNote from '../components/MobileDesktopNote';
import SignalMark from '../components/SignalMark';

const repositoryUrl = 'https://github.com/Aditya-Ramachandran/Signal';

function GuideHeader({ theme, onTheme }: { theme: 'light' | 'dark'; onTheme: () => void }) {
  return <header className="guide-header"><Link className="brand" href="/welcome"><SignalMark/><span className="guide-brand-copy"><span className="wordmark">Signal</span><span className="tagline">Less noise. More signal.</span></span></Link><nav><Link href="/welcome">Welcome</Link><Link href="/?demo=1">Try the demo</Link><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={onTheme}><span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span></button></nav></header>;
}

function Step({ number, emoji, title, children }: { number: string; emoji: string; title: string; children: React.ReactNode }) {
  return <section className="guide-step"><div className="guide-step-number"><span className="mono">{number}</span><span aria-hidden="true">{emoji}</span></div><div><h2>{title}</h2>{children}</div></section>;
}

export default function GuidePage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => { if (window.localStorage.getItem('signal-theme') === 'dark') setTheme('dark'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('signal-theme', theme); }, [theme]);

  return <main className="guide-shell">
    <GuideHeader theme={theme} onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}/>
    <MobileDesktopNote/>
    <section className="guide-intro"><div><h1>Set up your<br/>morning signal.</h1><p>Start with the demo in seconds. Build your own private feed only when you are ready for the technical setup.</p><div className="guide-actions"><Link className="btn primary" href="/?demo=1">Try the demo</Link><a className="btn" href={repositoryUrl} target="_blank" rel="noreferrer">Open GitHub ↗</a></div></div><aside><strong>Choose your path</strong><p><strong>Explore:</strong> see the morning queue immediately.<br/><strong>Deploy:</strong> host your own private Signal workspace.<br/><strong>Connect:</strong> add the optional jobs-feed pipeline when you want live roles.</p><span>No secrets live in Signal.</span></aside></section>

    <div className="guide-quickstart"><strong>Before you begin</strong><span>For the full self-hosted setup, you need a Google account, GitHub account, OpenAI API key with credit, and time to configure the optional pipeline. You do not need to give Signal access to your Gmail or Sheet.</span></div>
    <div className="guide-momentum"><span>☀️ <strong>Tomorrow morning:</strong> open one queue, not five job boards.</span><span>🔒 <strong>Your data:</strong> your pipeline, your Sheet, your account.</span><span>🚀 <strong>Start small:</strong> get jobs working first; Outreach can wait.</span></div>

    <div className="guide-body">
      <div className="guide-rail"><span>Build your pipeline</span><span>Connect Signal</span><span>Make it yours</span></div>
      <div className="guide-steps">
        <Step number="1" emoji="🧭" title="Create your private pipeline">
          <p>Fork or copy the private <code>job-pipeline</code> repository, then add <code>daily_jobs.py</code>, <code>requirements.txt</code>, and <code>.github/workflows/daily.yml</code>. Keep this repository private: it is where your API keys and job-search configuration belong.</p>
          <p className="guide-note">Signal is only the dashboard. Your pipeline remains yours.</p>
        </Step>
        <Step number="2" emoji="📋" title="Make a Google Sheet tracker">
          <p>Create a blank Google Sheet and copy its ID from the URL. Then open <a href="https://script.google.com" target="_blank" rel="noreferrer">Google Apps Script ↗</a>, create a standalone project, and paste in the bridge script from your pipeline setup.</p>
          <p>In Script properties, add <code>SHEET_ID</code> and a long random <code>BOT_SECRET</code>. Deploy it as a Web app that runs as you. Keep the resulting <code>/exec</code> URL handy.</p>
        </Step>
        <Step number="3" emoji="🔐" title="Give GitHub the private keys">
          <p>In your pipeline repository, go to <strong>Settings → Secrets and variables → Actions</strong>. Add the values below as repository secrets.</p>
          <div className="guide-key-list"><span><code>OPENAI_API_KEY</code><small>Your OpenAI API key</small></span><span><code>SHEET_API_URL</code><small>Your Apps Script <code>/exec</code> URL</small></span><span><code>SHEET_API_SECRET</code><small>The same value as <code>BOT_SECRET</code></small></span><span><code>GMAIL_USER</code> + <code>GMAIL_APP_PASSWORD</code><small>Optional daily email report</small></span></div>
          <p className="guide-note">Never paste a GitHub token, Sheet ID, or bot secret into Signal.</p>
        </Step>
        <Step number="4" emoji="▶️" title="Run it once, on purpose">
          <p>Open the <strong>daily-backend-jobs</strong> workflow in GitHub Actions and choose <strong>Run workflow</strong>. The first run can take 10–30 minutes. When it finishes, your Sheet should have a <strong>Jobs</strong> tab with roles and referral messages.</p>
          <p>After that, the scheduled workflow runs each morning. GitHub may start it a little after the planned time.</p>
        </Step>
        <Step number="5" emoji="👋" title="Choose your workspace">
          <p><strong>Using someone else’s hosted Signal?</strong> Ask its owner to approve the exact Google email you will use. Google gives Signal your identity only—it does not grant access to your inbox or Sheet.</p>
          <p><strong>Running your own Signal?</strong> Deploy your own workspace, approve your own Google account, then connect the jobs feed you created above.</p>
        </Step>
        <Step number="6" emoji="🔗" title="Connect your read-only jobs feed">
          <p>In Signal, choose <strong>Manage jobs feed</strong>. Add your role preferences and paste the public read-only Apps Script <code>/exec</code> URL.</p>
          <p>Save the workspace, then open your morning queue. If the feed is healthy, your Sheet’s jobs become the roles you can act on.</p>
        </Step>
      </div>
    </div>

    <section className="guide-finish"><div><h2>That’s the loop.</h2><p>Read the lead role, copy the note, apply, and keep your next move visible. Outreach stays optional until you decide to add that task to your own pipeline.</p></div><Link className="btn primary" href="/welcome">Open Signal</Link></section>

    <section className="guide-troubleshooting"><h2>Small bumps, quick fixes.</h2><details><summary>The queue says it cannot load jobs.</summary><p>Confirm your Apps Script deployment is the latest version, the URL ends in <code>/exec</code>, and its read endpoint returns jobs. Then reopen Signal or use Refresh queue.</p></details><details><summary>I see an empty workspace after signing in.</summary><p>Use Connect jobs feed and save your own read-only URL. Each Google account has a separate Signal workspace.</p></details><details><summary>Google sign-in says access needs approval.</summary><p>This hosted workspace is private. Explore the guided demo, or fork Signal and connect your own pipeline using this guide.</p></details><details><summary>My pipeline found no jobs.</summary><p>Run the workflow again later or tune the role, location, and experience rules in <code>daily_jobs.py</code>. Portal rate limits can also temporarily reduce results.</p></details></section>
    <SignalFooter/>
  </main>;
}
