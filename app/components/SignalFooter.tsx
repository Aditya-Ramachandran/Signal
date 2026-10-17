'use client';

import { useEffect, useRef, useState } from 'react';

type SignalFooterProps = { variant?: 'default' | 'workspace' };

export default function SignalFooter({ variant = 'default' }: SignalFooterProps) {
  const footerRef = useRef<HTMLElement>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) { setSettled(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSettled(true); observer.disconnect(); } }, { threshold: .25 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const workspace = variant === 'workspace';
  return <footer ref={footerRef} className={`signal-footer ${settled ? 'is-settled' : ''}`}><div className="signal-footer-main"><div className="signal-footer-brand"><strong>Signal</strong><span>Less noise. More signal.</span></div><p><i aria-hidden="true" className="signal-footer-dot"/>{workspace ? 'Progress stays with your workspace.' : 'Tomorrow’s queue starts with one good decision.'}</p></div>{!workspace && <span className="signal-footer-note mono">Your pipeline. Your Sheet. Your job search.</span>}</footer>;
}
