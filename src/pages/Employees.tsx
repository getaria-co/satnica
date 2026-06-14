import { useState } from 'react';
import { Trash2, UserPlus, ChevronRight } from 'lucide-react';
import type { Employee } from '../types';
import type { Strings } from '../lib/i18n';
import { saveEmployee, deleteEmployee } from '../lib/storage';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props { employees: Employee[]; onRefresh: () => void; s: Strings; }

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
const EMPTY = { name: '', role: '', hourlyRate: '', sssNumber: '' };
const GRADIENTS = [
  'linear-gradient(135deg,#3b82f6,#6366f1)',
  'linear-gradient(135deg,#10b981,#0d9488)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#f97316,#ef4444)',
];
const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export default function Employees({ employees, onRefresh, s }: Props) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.role || !form.hourlyRate) { setError(s.errEmpRequired); return; }
    const rate = parseFloat(form.hourlyRate);
    if (isNaN(rate) || rate <= 0) { setError(s.errRate); return; }
    saveEmployee({ id: genId(), name: form.name.trim(), role: form.role.trim(), hourlyRate: rate, sssNumber: form.sssNumber.trim() || undefined });
    onRefresh(); setForm(EMPTY); setShowForm(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="s-page-title" style={{ margin: 0 }}>{s.empTitle}</h1>
        <button onClick={() => setShowForm(f => !f)} style={{
          background: showForm ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
          color: showForm ? 'var(--text2)' : '#fff',
          border: showForm ? '1px solid var(--border2)' : 'none',
          borderRadius: 12, padding: '10px 16px', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: showForm ? 'none' : '0 4px 16px rgba(59,130,246,0.35)',
        }}>
          <UserPlus size={16} />{showForm ? 'Cancel' : s.addEmp}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow)' }} className="fade-in">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>{s.addEmp}</div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: `${s.fieldName} *`, key: 'name', ph: s.namePlaceholder, type: 'text' },
                { label: `${s.fieldRole} *`, key: 'role', ph: s.rolePlaceholder, type: 'text' },
                { label: `${s.fieldRate} *`, key: 'hourlyRate', ph: s.ratePlaceholder, type: 'number' },
                { label: s.fieldOib, key: 'sssNumber', ph: s.oibPlaceholder, type: 'text' },
              ].map(({ label, key, ph, type }) => (
                <div key={key}>
                  <label className="s-label">{label}</label>
                  <input type={type} step={type==='number'?'0.01':undefined} min={type==='number'?'0':undefined}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="s-input" placeholder={ph} />
                </div>
              ))}
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <button type="submit" className="s-btn" style={{ width: isMobile ? '100%' : 'auto' }}>{s.saveEmp}</button>
          </form>
        </div>
      )}

      {employees.length === 0 && !showForm && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <UserPlus size={24} color="var(--text3)" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No employees yet</div>
          <div style={{ color: 'var(--text3)', fontSize: 14 }}>{s.noEmployees}</div>
        </div>
      )}

      {employees.map((emp, i) => (
        <div key={emp.id} style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', padding: 16,
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: 'var(--shadow)',
        }} className="fade-in">
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: GRADIENTS[i % GRADIENTS.length],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>{initials(emp.name)}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {emp.role}{emp.sssNumber ? ` · ${s.oibLabel}: ${emp.sssNumber}` : ''}
            </div>
          </div>

          <div style={{ textAlign: 'right', marginRight: 4 }}>
            <div style={{ fontSize: 19, fontWeight: 800, background: 'linear-gradient(135deg,#f59e0b,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {emp.hourlyRate} €
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.perHourLabel}</div>
          </div>

          <button onClick={() => { if (confirm(`Delete ${emp.name}?`)) { deleteEmployee(emp.id); onRefresh(); } }} style={{
            background: 'none', border: 'none', color: 'var(--text4)', padding: 6, borderRadius: 8,
          }}>
            <Trash2 size={17} />
          </button>
        </div>
      ))}
    </div>
  );
}
