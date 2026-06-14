import { LayoutDashboard, Clock, DollarSign, Users, Upload, Sun, Moon, Globe } from 'lucide-react';
import type { Lang, Strings } from '../lib/i18n';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  lang: Lang;
  onLangChange: (l: Lang) => void;
  theme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
  s: Strings;
}

const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
  { id: 'time',      icon: Clock,           labelKey: 'time' },
  { id: 'payroll',   icon: DollarSign,      labelKey: 'payroll' },
  { id: 'employees', icon: Users,           labelKey: 'employees' },
  { id: 'import',    icon: Upload,          labelKey: 'import' },
] as const;

export default function Layout({ children, activeTab, onTabChange, lang, onLangChange, theme, onThemeChange, s }: Props) {
  const isMobile = useIsMobile();
  if (!s) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── DESKTOP HEADER ── */}
      {!isMobile && (
        <header style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '0 28px',
          display: 'flex', alignItems: 'center', gap: 20,
          height: 60, flexShrink: 0,
          boxShadow: '0 1px 0 var(--border)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              width: 32, height: 32, borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}>
              <Clock size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3, color: 'var(--text)' }}>Satnica</span>
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border2)', margin: '0 4px' }} />

          {/* Nav tabs */}
          <nav style={{ display: 'flex', gap: 2 }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: 600,
                  background: isActive ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text2)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  borderRadius: isActive ? '8px 8px 0 0' : 8,
                }}>
                  <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                  {s.tabs[tab.labelKey]}
                </button>
              );
            })}
          </nav>

          {/* Right controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <CtrlBtn onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </CtrlBtn>
            <CtrlBtn onClick={() => onLangChange(lang === 'hr' ? 'en' : 'hr')}>
              <Globe size={14} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>{lang.toUpperCase()}</span>
            </CtrlBtn>
          </div>
        </header>
      )}

      {/* ── MOBILE HEADER ── */}
      {isMobile && (
        <header style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '0 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 54, flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 1px 20px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              width: 28, height: 28, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Clock size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>Satnica</span>
            <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 2 }}>
              · {s.tabs[activeTab as keyof typeof s.tabs] ?? ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <CtrlBtn onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </CtrlBtn>
            <CtrlBtn onClick={() => onLangChange(lang === 'hr' ? 'en' : 'hr')}>
              <Globe size={13} />
              <span style={{ fontSize: 10, fontWeight: 700 }}>{lang.toUpperCase()}</span>
            </CtrlBtn>
          </div>
        </header>
      )}

      {/* ── CONTENT ── */}
      <main style={{
        flex: 1,
        padding: isMobile ? 14 : '24px 28px',
        maxWidth: isMobile ? '100%' : 1140,
        width: '100%',
        margin: '0 auto',
        paddingBottom: isMobile ? 88 : 32,
      }}>
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '10px 4px 8px',
                background: 'none', border: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text3)',
                position: 'relative',
              }}>
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 28, height: 2, borderRadius: 2,
                    background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
                  }} />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span style={{ fontSize: 9.5, fontWeight: isActive ? 700 : 500, letterSpacing: 0.2 }}>
                  {s.tabs[tab.labelKey]}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function CtrlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--surface2)', border: '1px solid var(--border2)',
      color: 'var(--text2)', borderRadius: 8,
      padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 12, fontWeight: 600,
    }}>{children}</button>
  );
}
