import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { Employee, TimeEntry } from '../types';
import type { Strings } from '../lib/i18n';
import { saveEntry, deleteEntry } from '../lib/storage';
import { calcHours } from '../lib/payroll';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props { employees: Employee[]; entries: TimeEntry[]; onRefresh: () => void; s: Strings; }

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function TimeEntryPage({ employees, entries, onRefresh, s }: Props) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ employeeId: '', date: new Date().toISOString().split('T')[0], clockIn: '', clockOut: '', note: '' });
  const [error, setError] = useState('');
  const [filterEmp, setFilterEmp] = useState('');
  const [showForm, setShowForm] = useState(!isMobile);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.employeeId || !form.date || !form.clockIn || !form.clockOut) { setError(s.errRequired); return; }
    const hours = calcHours(form.clockIn, form.clockOut);
    if (hours <= 0) { setError(s.errTime); return; }
    saveEntry({ id: genId(), employeeId: form.employeeId, date: form.date, clockIn: form.clockIn, clockOut: form.clockOut, hoursWorked: hours, note: form.note });
    onRefresh();
    setForm(f => ({ ...f, clockIn: '', clockOut: '', note: '' }));
    if (isMobile) setShowForm(false);
  }

  const displayed = entries
    .filter(e => !filterEmp || e.employeeId === filterEmp)
    .sort((a, b) => b.date.localeCompare(a.date) || b.clockIn.localeCompare(a.clockIn));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="s-page-title" style={{ margin: 0 }}>{s.timeTitle}</h1>
        {isMobile && (
          <button onClick={() => setShowForm(f => !f)} style={{
            background: showForm ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: showForm ? 'var(--text2)' : '#fff',
            border: showForm ? '1px solid var(--border2)' : 'none',
            borderRadius: 12, padding: '10px 14px', fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: showForm ? 'none' : '0 4px 16px rgba(59,130,246,0.35)',
          }}>
            <Plus size={16} />{showForm ? 'Cancel' : 'Add'}
          </button>
        )}
      </div>

      {(showForm || !isMobile) && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow)' }} className="fade-in">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{s.newEntry}</div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5,1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: `${s.fieldEmployee} *`, el: (
                  <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className="s-input">
                    <option value="">{s.selectEmployee}</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                )},
                { label: `${s.fieldDate} *`, el: <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="s-input" /> },
                { label: `${s.fieldIn} *`, el: <input type="time" value={form.clockIn} onChange={e => setForm(f => ({ ...f, clockIn: e.target.value }))} className="s-input" /> },
                { label: `${s.fieldOut} *`, el: <input type="time" value={form.clockOut} onChange={e => setForm(f => ({ ...f, clockOut: e.target.value }))} className="s-input" /> },
                { label: s.fieldNote, el: <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="s-input" placeholder={s.notePlaceholder} /> },
              ].map(({ label, el }) => (
                <div key={label}><label className="s-label">{label}</label>{el}</div>
              ))}
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{error}</div>}
            <button type="submit" className="s-btn" style={{ width: isMobile ? '100%' : 'auto' }}>{s.saveEntry}</button>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="s-section" style={{ margin: 0, whiteSpace: 'nowrap' }}>{s.logTitle}</div>
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} className="s-input" style={{ maxWidth: 180, padding: '8px 10px', fontSize: 13 }}>
          <option value="">{s.allEmployees}</option>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
      </div>

      {/* Entries */}
      {displayed.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
          {s.noEntries}
        </div>
      )}

      {displayed.map(entry => {
        const emp = employees.find(e => e.id === entry.employeeId);
        const isShort = entry.hoursWorked < 8;
        return (
          <div key={entry.id} style={{
            background: 'var(--surface)', borderRadius: 14,
            border: `1px solid ${isShort ? 'rgba(251,146,60,0.2)' : 'var(--border)'}`,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: isShort ? 'rgba(251,146,60,0.12)' : 'rgba(16,185,129,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800,
              color: isShort ? '#fb923c' : '#10b981',
            }}>{entry.hoursWorked}h</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{emp?.name ?? '—'}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 6, padding: '2px 7px' }}>{entry.date}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{entry.clockIn} → {entry.clockOut}</span>
                {isShort && <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>−{(8 - entry.hoursWorked).toFixed(2)}h</span>}
                {entry.note && <span style={{ color: 'var(--text3)', fontSize: 11 }}>· {entry.note}</span>}
              </div>
            </div>

            <button onClick={() => { deleteEntry(entry.id); onRefresh(); }} style={{ background: 'none', border: 'none', color: 'var(--text4)', padding: 6, borderRadius: 8 }}>
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
