import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Trophy, Users, Zap } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import './AuthLanding.css';

type AuthShellProps = {
  active: 'login' | 'register' | 'forgot' | 'reset';
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('land-brand', compact && 'land-brand--compact')}>
      <img
        src="/branding/turfscore-mark.svg"
        alt=""
        width={compact ? 44 : 48}
        height={compact ? 44 : 48}
      />
      <div>
        <p className="land-brand__name">
          <span>Turf</span>Score
        </p>
        <p className="land-brand__tag">Live cricket scoring</p>
      </div>
    </div>
  );
}

/** Full-bleed stadium landing + compact glass auth card. */
export function AuthShell({ active, children, title, subtitle }: AuthShellProps) {
  const marketing = active === 'login' || active === 'register';

  useEffect(() => {
    const prev = document.body.style.background;
    const prevImg = document.body.style.backgroundImage;
    document.body.style.background = '#020D0B';
    document.body.style.backgroundImage = 'none';
    return () => {
      document.body.style.background = prev;
      document.body.style.backgroundImage = prevImg;
    };
  }, []);

  return (
    <div className={cn('land', marketing ? 'land--marketing' : 'land--recovery')}>
      <div className="land__bg" aria-hidden>
        <img
          className="land__photo"
          src="/images/turfscore-landing-bg.png"
          alt=""
          decoding="async"
          fetchPriority="high"
        />
        <div className="land__shade" />
        <div className="land__glow" />
      </div>

      <div className="land__frame">
        <header className="land__top">
          <Brand />
          {marketing ? (
            <div className="land__pitch">
              <Trophy aria-hidden className="land__pitch-icon" strokeWidth={1.75} />
              <span className="land__pitch-bar" aria-hidden />
              <p>
                <span>Score Faster. Watch Live.</span>
                <strong>Play Better.</strong>
              </p>
            </div>
          ) : null}
        </header>

        <div className="land__main">
          {marketing ? (
            <section className="land__copy">
              <ul className="land__features">
                <li>
                  <span className="land__feat-icon" aria-hidden>
                    <Zap />
                  </span>
                  <span>
                    <strong>Live Scoring</strong>
                    <small>Real-time updates</small>
                  </span>
                </li>
                <li className="land__feat-sep" aria-hidden />
                <li>
                  <span className="land__feat-icon" aria-hidden>
                    <Users />
                  </span>
                  <span>
                    <strong>Team &amp; Player</strong>
                    <small>Management</small>
                  </span>
                </li>
                <li className="land__feat-sep" aria-hidden />
                <li>
                  <span className="land__feat-icon" aria-hidden>
                    <Smartphone />
                  </span>
                  <span>
                    <strong>Works Offline</strong>
                    <small>Syncs when online</small>
                  </span>
                </li>
              </ul>
            </section>
          ) : (
            <section className="land__copy land__copy--short" aria-hidden />
          )}

          <section className="land__panel">
            <div className="land__card">
              {marketing ? (
                <>
                  <div className="land__card-brand">
                    <Brand compact />
                  </div>
                  <div className="land__tabs" role="tablist" aria-label="Account">
                    <Link
                      to="/login"
                      role="tab"
                      aria-selected={active === 'login'}
                      className={cn('land__tab', active === 'login' && 'land__tab--on')}
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      role="tab"
                      aria-selected={active === 'register'}
                      className={cn('land__tab', active === 'register' && 'land__tab--on')}
                    >
                      Register
                    </Link>
                  </div>
                </>
              ) : (
                <Link to="/login" className="land__back">
                  ← Back to login
                </Link>
              )}

              {title ? <h2 className="land__title">{title}</h2> : null}
              {subtitle ? <p className="land__subtitle">{subtitle}</p> : null}

              <div className="land__body">{children}</div>
            </div>
          </section>
        </div>
      </div>

      <Toast />
    </div>
  );
}
