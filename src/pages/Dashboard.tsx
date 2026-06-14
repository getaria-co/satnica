import { useMemo, useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Coffee, Utensils } from 'lucide-react';
import type { Employee, TimeEntry } from '../types';
import type { Strings } from '../lib/i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import { useActiveClock, getMyEmployeeId, setMyEmployeeId } from '../hooks/useActiveClock';
import { saveEntry } from '../lib/storage';

interface Props { employees: Employee[]; entries: TimeEntry[]; onRefresh: () => void; s: Strings; }

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
}

function toMinutes(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function nowTime(d = new Date()) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function elapsedStr(fromMin: number, nowMin: number) {
  const diff = Math.max(0, nowMin - fromMin);
  return `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2,'0')}m`;
}

// SVG progress ring
function ProgressRing({ progress, color, size = 220, stroke = 10 }: { progress: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
      />
    </svg>
  );
}

const STATUS_STYLE = {
  idle:    { ring: '#3b82f6', label: '',                      pulse: '' },
  working: { ring: '#10b981', label: '● Working',             pulse: 'pulse-ring' },
  kratka:  { ring: '#f59e0b', label: '☕ Kratka pauza',       pulse: 'pulse-break' },
  pauza:   { ring: '#f97316', label: '🍽 Pauza (meal break)', pulse: 'pulse-break' },
};

export default function Dashboard({ employees, entries, onRefresh, s }: Props) {
  const isMobile = useIsMobile();
  const now = useLiveClock();
  const { active, clockIn, startBreak, endBreak, clockOut } = useActiveClock();
  const [myEmpId, setMyEmpId] = useState(getMyEmployeeId);
  const [showEmpPicker, setShowEmpPicker] = useState(false);

  const today = now.toISOString().split('T')[0];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const isMine = active?.employeeId === myEmpId;
  const status = isMine ? (active?.status ?? 'idle') : 'idle';
  const ss = STATUS_STYLE[status];

  const shiftMinutes = isMine && active ? nowMin - toMinutes(active.clockIn) : 0;
  const ringProgress = isMine ? Math.min(shiftMinutes / 480, 1) : 0; // 480 = 8h

  const lastBreak = active?.breaks[active.breaks.length - 1];
  const onBreak = status === 'kratka' || status === 'pauza';
  const breakMinutes = onBreak && lastBreak ? nowMin - toMinutes(lastBreak.start) : 0;

  const todayEntries = entries.filter(e => e.date === today);
  const month = today.slice(0, 7);
  const totalHoursMonth = entries.filter(e => e.date.startsWith(month)).reduce((s, e) => s + e.hoursWorked, 0);
  const shortDays = entries.filter(e => e.hoursWorked < 8 && e.hoursWorked > 0);
  const myEntry = todayEntries.find(e => e.employeeId === myEmpId);
  const myEmployee = employees.find(e => e.id === myEmpId);

  function handleClockIn() {
    if (!myEmpId) { setShowEmpPicker(true); return; }
    clockIn(myEmpId);
  }

  function handleClockOut() {
    const current = clockOut();
    if (!current) return;
    const out = nowTime();
    const hoursWorked = Math.round((nowMin - toMinutes(current.clockIn)) / 60 * 100) / 100;
    const breakSummary = current.breaks.map(b =>
      b.type === 'kratka' ? `Kratka ${b.start}–${b.end ?? out}` : `Pauza ${b.start}–${b.end ?? out}`
    ).join(', ');
    if (hoursWorked > 0) {
      saveEntry({ id: genId(), employeeId: current.employeeId, date: current.date, clockIn: current.clockIn, clockOut: out, hoursWorked, note: breakSummary || undefined });
      onRefresh();
    }
  }

  const RING_SIZE = isMobile ? 220 : 240;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── HERO CLOCK CARD ── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: status !== 'idle' ? `var(--shadow-lg), 0 0 60px ${ss.ring}18` : 'var(--shadow)',
        padding: isMobile ? '24px 20px 20px' : '32px 32px 28px',
        transition: 'box-shadow 0.4s',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background gradient blob */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 200, height: 200,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${ss.ring}18 0%, transparent 70%)`,
          transition: 'background 0.4s',
          pointerEvents: 'none',
        }} />

        {/* Profile picker */}
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <button onClick={() => setShowEmpPicker(v => !v)} style={{
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            borderRadius: 20, padding: '5px 12px 5px 8px',
            fontSize: 12, color: 'var(--text2)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: myEmployee ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'var(--surface3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800, color: '#fff',
            }}>
              {myEmployee ? myEmployee.name[0] : '?'}
            </div>
            {myEmployee ? myEmployee.name.split(' ')[0] : 'Set Profile'} ▾
          </button>

          {showEmpPicker && (
            <div style={{
              position: 'absolute', top: 38, right: 0,
              background: 'var(--surface)', border: '1px solid var(--border2)',
              borderRadius: 12, zIndex: 50, minWidth: 190,
              boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
            }}>
              {employees.length === 0
                ? <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text3)' }}>Add employees first</div>
                : employees.map(emp => (
                  <button key={emp.id} onClick={() => { setMyEmpId(emp.id); setMyEmployeeId(emp.id); setShowEmpPicker(false); }} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '11px 16px', background: emp.id === myEmpId ? 'var(--surface2)' : 'none',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    color: 'var(--text)', fontSize: 14, fontWeight: emp.id === myEmpId ? 700 : 400,
                  }}>{emp.name}</button>
                ))
              }
            </div>
          )}
        </div>

        {/* Clock with progress ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', width: RING_SIZE, height: RING_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ProgressRing progress={ringProgress} color={ss.ring} size={RING_SIZE} stroke={isMobile ? 8 : 10} />
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{
                fontSize: isMobile ? 44 : 52, fontWeight: 800, letterSpacing: -2,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: 'var(--text)',
              }}>
                {now.toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, textTransform: 'capitalize' }}>
                {now.toLocaleDateString('hr', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              {status !== 'idle' && (
                <div style={{ marginTop: 10, fontSize: 13, color: ss.ring, fontWeight: 700 }}>
                  {elapsedStr(toMinutes(active!.clockIn), nowMin)}
                  {onBreak && <span style={{ opacity: 0.6, fontWeight: 400 }}> · break {elapsedStr(toMinutes(lastBreak!.start), nowMin)}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Status badge */}
          {status !== 'idle' && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: `${ss.ring}18`, color: ss.ring,
              border: `1px solid ${ss.ring}40`,
              borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 700,
              marginTop: -8, marginBottom: 4,
              animation: `${ss.pulse} 2s infinite`,
            }}>{ss.label}</div>
          )}
        </div>

        {/* ── ACTION BUTTONS ── */}
        {myEntry && !isMine ? (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={20} color="#10b981" />
            <div>
              <div style={{ fontWeight: 700, color: '#10b981', fontSize: 14 }}>Logged for today</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{myEntry.clockIn} → {myEntry.clockOut} · {myEntry.hoursWorked}h</div>
            </div>
          </div>
        ) : status === 'idle' ? (
          <div style={{ textAlign: 'center' }}>
            {!myEmpId && <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>Tap "Set Profile" above to get started</div>}
            <button onClick={handleClockIn} disabled={!myEmpId} style={{
              background: myEmpId ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--surface2)',
              color: myEmpId ? '#fff' : 'var(--text4)',
              border: 'none', borderRadius: 16,
              padding: isMobile ? '18px 0' : '16px 60px',
              width: isMobile ? '100%' : 'auto',
              fontSize: 20, fontWeight: 800, letterSpacing: 0.5,
              boxShadow: myEmpId ? '0 6px 28px rgba(16,185,129,0.45)' : 'none',
              cursor: myEmpId ? 'pointer' : 'not-allowed',
            }}>CLOCK IN</button>
          </div>
        ) : status === 'working' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => startBreak('kratka')} style={{
                background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                border: '1.5px solid rgba(245,158,11,0.4)',
                borderRadius: 14, padding: '14px 8px', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Coffee size={18} /> Kratka pauza
              </button>
              <button onClick={() => startBreak('pauza')} style={{
                background: 'rgba(249,115,22,0.1)', color: '#f97316',
                border: '1.5px solid rgba(249,115,22,0.4)',
                borderRadius: 14, padding: '14px 8px', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Utensils size={18} /> Pauza
              </button>
            </div>
            <button onClick={handleClockOut} style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#fff', border: 'none', borderRadius: 14,
              padding: '16px', fontSize: 18, fontWeight: 800, letterSpacing: 0.5,
              boxShadow: '0 6px 24px rgba(220,38,38,0.4)',
            }}>CLOCK OUT</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={endBreak} style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', border: 'none', borderRadius: 14,
              padding: '16px', fontSize: 18, fontWeight: 800,
              boxShadow: '0 6px 24px rgba(16,185,129,0.4)',
            }}>▶ RESUME</button>
            <button onClick={handleClockOut} style={{
              background: 'none', color: '#ef4444',
              border: '1.5px solid rgba(239,68,68,0.4)',
              borderRadius: 14, padding: '12px', fontSize: 15, fontWeight: 700,
            }}>CLOCK OUT</button>
          </div>
        )}

        {/* Break log */}
        {isMine && active && active.breaks.length > 0 && (
          <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div className="s-section" style={{ marginBottom: 8 }}>Today's breaks</div>
            {active.breaks.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text2)', padding: '5px 0', borderBottom: i < active.breaks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {b.type === 'kratka'
                    ? <Coffee size={13} color="#f59e0b" />
                    : <Utensils size={13} color="#f97316" />}
                  <span style={{ color: b.type === 'kratka' ? '#f59e0b' : '#f97316', fontWeight: 600 }}>
                    {b.type === 'kratka' ? 'Kratka pauza' : 'Pauza'}
                  </span>
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {b.start}{b.end ? ` → ${b.end}` : <span style={{ color: 'var(--text3)' }}> → ongoing</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── STATS ── */}
      <div className="grid-4">
        {[
          { label: s.statEmployees, value: employees.length, note: s.statEmployeesNote, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
          { label: s.statToday, value: todayEntries.length, note: s.statTodayNote(employees.length), color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
          { label: s.statHours, value: `${totalHoursMonth.toFixed(1)}h`, note: s.statHoursNote, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
          { label: s.statShort, value: shortDays.length, note: s.statShortNote, color: shortDays.length > 0 ? '#ef4444' : '#10b981', bg: shortDays.length > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: stat.bg, borderRadius: 14,
            border: `1px solid ${stat.color}28`,
            padding: isMobile ? '14px' : '18px',
          }}>
            <div style={{ fontSize: 10, color: stat.color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, fontWeight: 700, opacity: 0.8 }}>{stat.label}</div>
            <div style={{ fontSize: isMobile ? 26 : 30, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{stat.note}</div>
          </div>
        ))}
      </div>

      {/* ── SHORT DAYS ALERT ── */}
      {shortDays.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid rgba(251,146,60,0.2)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div style={{ padding: '12px 16px', background: 'rgba(251,146,60,0.08)', borderBottom: '1px solid rgba(251,146,60,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="#fb923c" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fb923c' }}>{s.shortDaysTitle}</span>
          </div>
          {shortDays.slice(0, 5).map(entry => {
            const emp = employees.find(e => e.id === entry.employeeId);
            return (
              <div key={entry.id} style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{emp?.name ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{entry.date} · {entry.clockIn} → {entry.clockOut}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#fb923c', fontWeight: 800, fontSize: 17 }}>{entry.hoursWorked}h</div>
                  <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>−{(8 - entry.hoursWorked).toFixed(2)}h</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shortDays.length === 0 && employees.length > 0 && (
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: 16, textAlign: 'center', color: '#10b981', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <CheckCircle size={16} /> {s.noShortDays}
        </div>
      )}
    </div>
  );
}
