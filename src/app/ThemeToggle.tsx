'use client';

import { useEffect, useState } from 'react';

/** Inline, runs before hydration so a returning dark-mode visitor doesn't
    see a flash of the light theme while React boots. Defaults to light --
    no system-preference fallback, per §6.E's redesign brief: light unless
    someone has actually chosen dark on this browser before. */
export function ThemeInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{var t=localStorage.getItem('dula-theme');if(t==='dark')document.documentElement.dataset.theme='dark';}catch(e){}`,
      }}
    />
  );
}

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.dataset.theme === 'dark');
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('dula-theme', next ? 'dark' : 'light');
    } catch {
      // Private browsing / storage blocked -- the toggle still works for
      // this page load, it just won't stick on the next visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{ fontSize: 12, padding: '5px 9px' }}
    >
      {isDark ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
