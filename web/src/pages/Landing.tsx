import { useEffect, useState, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const [signupClosedOpen, setSignupClosedOpen] = useState(false);

  // Marquee duplication + scroll-reveal observer, ported from the
  // <script> blocks in the source HTML.
  useEffect(() => {
    const track = document.getElementById('mdl-marquee-track');
    if (track && !track.dataset.populated) {
      const items: Array<[string, string]> = [
        ['⚡', 'Sub-10ms redirects'],
        ['🌐', 'Global edge network'],
        ['📊', 'Real-time analytics'],
        ['🔒', 'Password protection'],
        ['✨', 'Custom aliases'],
        ['📷', 'QR code generation'],
        ['⏱', 'Link expiration'],
        ['📁', 'Groups & folders'],
      ];
      const build = () =>
        items.map(([ico, t]) =>
          `<span><span style="opacity:.8">${ico}</span> ${t}</span><span class="dot"></span>`,
        ).join('');
      track.innerHTML = build() + build();
      track.dataset.populated = '1';
    }

    const reveals = document.querySelectorAll('.mdl-landing-root .reveal');
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(el => el.classList.add('revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    reveals.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goToSignIn = () => navigate('/workspace');
  const openSignupClosed = (e?: MouseEvent) => {
    e?.preventDefault();
    setSignupClosedOpen(true);
  };

  return (
    <div className="mdl-landing-root">
      {/* Reusable SVG icons */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="i-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 14a4.5 4.5 0 0 0 6.36 0l2.83-2.83a4.5 4.5 0 0 0-6.36-6.36L11.4 6.24" />
            <path d="M14 10a4.5 4.5 0 0 0-6.36 0L4.8 12.83a4.5 4.5 0 0 0 6.36 6.36L12.6 17.76" />
          </symbol>
          <symbol id="i-edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </symbol>
          <symbol id="i-chart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M7 15l4-5 4 3 5-7" />
          </symbol>
          <symbol id="i-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
          </symbol>
          <symbol id="i-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          </symbol>
          <symbol id="i-qr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3M21 14v3M14 21h3M21 18v3" />
          </symbol>
          <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </symbol>
          <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </symbol>
          <symbol id="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </symbol>
          <symbol id="i-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.6 13.4 13 21l-9-9V4h8l8.6 8.6a1.4 1.4 0 0 1 0 2z" /><circle cx="8" cy="8" r="1.5" />
          </symbol>
          <symbol id="i-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1.2" /><circle cx="4" cy="12" r="1.2" /><circle cx="4" cy="18" r="1.2" />
          </symbol>
          <symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </symbol>
          <symbol id="i-extlink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
          </symbol>
          <symbol id="i-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" />
          </symbol>
        </defs>
      </svg>

      {/* ============ NAV ============ */}
      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="logo" aria-label="MDL.cc home">
            <svg><use href="#i-link" /></svg>
            <span>MDL<span className="dot-cc">.cc</span></span>
          </a>
          <div className="nav-actions">
            <button onClick={goToSignIn} className="btn btn-link signin" type="button">Sign In</button>
            <button onClick={openSignupClosed} className="btn btn-primary" type="button">
              Sign Up <svg width="14" height="14" style={{ marginLeft: 2 }}><use href="#i-arrow" /></svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero">
        <div className="container hero-inner">
          <div className="eyebrow hero-eyebrow">Cloudflare Edge · Global · Sub-10ms</div>

          <h1 className="hero-headline">
            The middle-point between<br />you and your <span className="accent-word">audience.</span>
          </h1>

          <p className="hero-sub hero-sub-anim">
            MDL.cc transforms long, forgettable URLs into fast, trackable short links —
            powered by Cloudflare's global edge network.
          </p>

          <div className="hero-preview hero-widget" aria-hidden="true">
            <div className="hero-preview-row">
              <svg className="link-icon"><use href="#i-link" /></svg>
              <span className="hero-preview-url">mdl.cc/launch-26</span>
              <span className="hero-preview-badge"><span className="pulse-dot"></span>Live</span>
            </div>
            <div className="hero-preview-meta">
              <span><b>1,284</b> clicks today</span>
              <span><b>42</b> countries</span>
              <span><b>8ms</b> avg redirect</span>
            </div>
          </div>

          <div className="hero-ctas hero-ctas-an">
            <button onClick={openSignupClosed} className="btn btn-primary" type="button">
              Sign Up — Free <svg width="14" height="14" style={{ marginLeft: 2 }}><use href="#i-arrow" /></svg>
            </button>
            <button onClick={goToSignIn} className="btn btn-ghost" type="button">
              View Dashboard <svg width="14" height="14" style={{ marginLeft: 2 }}><use href="#i-extlink" /></svg>
            </button>
          </div>

          <div className="trust-strip hero-trust">
            <span>No credit card</span> · <span>Free tier</span> · <span>Live in 30 seconds</span>
          </div>
        </div>
      </header>

      {/* marquee bar */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track" id="mdl-marquee-track"></div>
      </div>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">How it works</div>
            <h2>Three steps.<br />Zero friction.</h2>
            <p>From a long URL to a tracked, branded short link — in less time than it takes to copy and paste.</p>
          </div>

          <div className="steps">
            <div className="step reveal" style={{ ['--i' as string]: 0 } as React.CSSProperties}>
              <div className="step-num">01</div>
              <div className="step-icon"><svg><use href="#i-link" /></svg></div>
              <h3>Paste your URL</h3>
              <p>Drop in any URL. MDL generates a short link instantly from Cloudflare's edge.</p>
            </div>
            <div className="step reveal" style={{ ['--i' as string]: 1 } as React.CSSProperties}>
              <div className="step-num">02</div>
              <div className="step-icon"><svg><use href="#i-edit" /></svg></div>
              <h3>Customize your link</h3>
              <p>Add a custom alias, password, expiration date, or generate a QR code in one click.</p>
            </div>
            <div className="step reveal" style={{ ['--i' as string]: 2 } as React.CSSProperties}>
              <div className="step-num">03</div>
              <div className="step-icon"><svg><use href="#i-chart" /></svg></div>
              <h3>Share &amp; track</h3>
              <p>Your audience hits the short link — you see clicks, geos, devices, and referrers live.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">Everything you need</div>
            <h2>Built for speed.<br />Designed for control.</h2>
            <p>Ten features. One unified dashboard. No bloat — just the link tooling teams actually use, running on the same edge network that delivers the rest of the modern web.</p>
          </div>

          <div className="features-grid">
            {[
              { i: 0, icon: 'i-bolt',  title: 'Ultra-Fast Redirects',   body: "KV-powered lookups deliver sub-10ms redirects from Cloudflare's edge — every time, everywhere." },
              { i: 1, icon: 'i-list',  title: 'Link Management',        body: 'Create, edit, and organize all your shortened URLs from a clean, unified dashboard.' },
              { i: 2, icon: 'i-folder',title: 'Groups & Folders',       body: 'Keep campaigns, projects, and teams organized with link groups and folder hierarchies.' },
              { i: 3, icon: 'i-chart', title: 'Real-Time Analytics',    body: 'Track clicks, geographic data, devices, browsers, and referrers the moment they happen.' },
              { i: 4, icon: 'i-qr',    title: 'QR Code Generation',     body: 'Generate fully customizable QR codes for any link — colors, sizes, and embed-ready.' },
              { i: 5, icon: 'i-edit',  title: 'Custom Aliases',         body: 'Choose your own short codes. Make links memorable and on-brand.' },
              { i: 6, icon: 'i-lock',  title: 'Password Protection',    body: 'Gate sensitive links behind a password for controlled, secure sharing.' },
              { i: 7, icon: 'i-clock', title: 'Link Expiration',        body: 'Set automatic expiration dates so links only work when you want them to.' },
              { i: 8, icon: 'i-moon',  title: 'Light & Dark Mode',      body: 'A beautiful, adaptive UI that looks perfect in any environment.' },
              { i: 9, icon: 'i-tag',   title: 'Branded Links',          body: 'Custom domain support for fully white-labeled short URLs.' },
            ].map(f => (
              <article key={f.i} className="feature-card reveal" style={{ ['--i' as string]: f.i } as React.CSSProperties}>
                <div className="feature-head">
                  <div className="feature-icon"><svg><use href={`#${f.icon}`} /></svg></div>
                  <h3>{f.title}</h3>
                </div>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="stats-section" id="stats">
        <div className="container">
          <div className="section-head center reveal">
            <div className="eyebrow">Edge-native by design</div>
            <h2>Numbers you can feel.</h2>
          </div>

          <div className="stats-grid">
            <div className="stat reveal" style={{ ['--i' as string]: 0 } as React.CSSProperties}>
              <div className="stat-num"><span className="lt">&lt;</span>10<span style={{ fontSize: '0.5em', letterSpacing: 0 }}>ms</span></div>
              <div className="stat-divider"></div>
              <div className="stat-label">Global redirect latency via KV</div>
            </div>
            <div className="stat reveal" style={{ ['--i' as string]: 1 } as React.CSSProperties}>
              <div className="stat-num">100<span style={{ fontSize: '0.6em' }}>+</span></div>
              <div className="stat-divider"></div>
              <div className="stat-label">Cloudflare edge locations worldwide</div>
            </div>
            <div className="stat reveal" style={{ ['--i' as string]: 2 } as React.CSSProperties}>
              <div className="stat-num">99.99<span style={{ fontSize: '0.55em' }}>%</span></div>
              <div className="stat-divider"></div>
              <div className="stat-label">Uptime SLA</div>
            </div>
          </div>

          <div className="arch reveal">
            <div className="arch-bar">
              <span className="arch-dots"><i></i><i></i><i></i></span>
              <span>mdl.cc / architecture</span>
              <span>edge.runtime</span>
            </div>
            <div className="arch-flow">
              <div className="arch-node">KV Store<small>cache</small></div>
              <div className="arch-arrow">→</div>
              <div className="arch-node">Worker Router<small>edge</small></div>
              <div className="arch-arrow">→</div>
              <div className="arch-node">D1 Database<small>state</small></div>
            </div>
            <div className="arch-caption">MDL.cc architecture — 100% Cloudflare native · every redirect resolves in under 10ms</div>
          </div>

          <div className="pull-quote reveal">
            <blockquote>
              "MDL was built the way infrastructure should be —
              close to the user, fast by default, and out of the way."
            </blockquote>
            <div className="attribution">Powered by Cloudflare Workers · D1 · KV</div>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="final-cta" id="cta">
        <div className="container">
          <div className="inner reveal">
            <div className="eyebrow">Get started</div>
            <h2>Start shortening links today.</h2>
            <p>Free to start. No credit card required. Powered by Cloudflare's global edge.</p>
            <button onClick={openSignupClosed} className="btn btn-primary pulse" type="button">
              Create Your Free Account <svg width="14" height="14" style={{ marginLeft: 2 }}><use href="#i-arrow" /></svg>
            </button>
            <div className="final-tagline">mdl.cc — the middle-point between you and your audience</div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer>
        <div className="container footer-inner">
          <div className="footer-left">
            <a href="/" className="logo" style={{ fontSize: 16 }}>
              <svg style={{ width: 18, height: 18 }}><use href="#i-link" /></svg>
              <span>MDL<span className="dot-cc">.cc</span></span>
            </a>
            <span className="dot">·</span>
            <span>© 2026 <a href="https://s-fx.com" target="_blank" rel="noopener noreferrer" className="sfx-link">S-FX.com</a> Small Business Solutions</span>
          </div>
          <div className="footer-right">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
        </div>
      </footer>

      {signupClosedOpen && (
        <div
          className="signup-modal-backdrop"
          onClick={() => setSignupClosedOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-closed-title"
        >
          <div className="signup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="signup-modal-icon">
              <svg><use href="#i-info" /></svg>
            </div>
            <h3 id="signup-closed-title">Sign-ups Temporarily Closed</h3>
            <p>MDL.cc is currently in Alpha &amp; Signups are Temporarily Closed.</p>
            <button
              type="button"
              className="signup-modal-ok"
              onClick={() => setSignupClosedOpen(false)}
              autoFocus
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
