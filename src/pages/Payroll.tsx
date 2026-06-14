import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, Download } from 'lucide-react';
import type { Employee, TimeEntry, DeductionMode } from '../types';
import type { Strings } from '../lib/i18n';
import { computePayroll } from '../lib/payroll';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props { employees: Employee[]; entries: TimeEntry[]; s: Strings; }

const MODES: { value: DeductionMode; color: string; glow: string; label: (s: Strings) => string }[] = [
  { value: 'full',    color: '#3b82f6', glow: 'rgba(59,130,246,0.3)',  label: s => s.modeFull },
  { value: 'pension', color: '#f59e0b', glow: 'rgba(245,158,11,0.3)',  label: s => s.modePension },
  { value: 'none',    color: '#10b981', glow: 'rgba(16,185,129,0.3)',  label: s => s.modeNone },
];

export default function Payroll({ employees, entries, s }: Props) {
  const isMobile = useIsMobile();
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [mode, setMode] = useState<DeductionMode>('full');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => entries.filter(e => e.date.startsWith(month)), [entries, month]);
  const results = useMemo(() => employees.map(emp => computePayroll(emp, filtered, month, mode)), [employees, filtered, month, mode]);
  const activeMode = MODES.find(m => m.value === mode)!;

  function buildRows() {
    const headers = [s.colEmployee, s.fieldRole, s.days, 'Hours', 'Gross (€)'];
    if (mode !== 'none') headers.push('MIO I (€)', 'MIO II (€)');
    if (mode === 'full') headers.push('Income Tax (€)');
    if (mode !== 'none') headers.push('Deductions (€)');
    headers.push('Net Pay (€)', 'HZZO ref (€)');
    return [headers, ...results.map(r => {
      const row: (string | number)[] = [r.employee.name, r.employee.role, r.daysWorked, r.totalHours, r.grossPay];
      if (mode !== 'none') row.push(r.mio1, r.mio2);
      if (mode === 'full') row.push(r.incomeTax);
      if (mode !== 'none') row.push(r.totalDeductions);
      row.push(r.netPay, r.healthInsurance);
      return row;
    })];
  }

  function exportCSV() {
    const csv = buildRows().map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `satnica_payroll_${month}.csv`; a.click();
  }

  function exportXLSX() {
    const rows = buildRows();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Payroll ${month}`);
    XLSX.writeFile(wb, `satnica_payroll_${month}.xlsx`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 className="s-page-title" style={{ margin: 0 }}>{s.payrollTitle}</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="s-input" style={{ width: 'auto', padding: '9px 12px', fontSize: 14 }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} className="s-btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={exportXLSX} style={{
            background: 'rgba(16,185,129,0.1)', color: '#10b981',
            border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10,
            padding: '10px 14px', fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 14 }}>
        <div className="s-section" style={{ marginBottom: 10 }}>{s.modeLabel}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MODES.map(m => (
            <button key={m.value} onClick={() => setMode(m.value)} style={{
              flex: isMobile ? 1 : 'none',
              padding: '10px 14px', borderRadius: 10, fontSize: isMobile ? 12 : 13, fontWeight: 600,
              border: `1.5px solid ${mode === m.value ? m.color : 'var(--border2)'}`,
              background: mode === m.value ? `${m.color}15` : 'transparent',
              color: mode === m.value ? m.color : 'var(--text3)',
              boxShadow: mode === m.value ? `0 0 16px ${m.glow}` : 'none',
              transition: 'all 0.2s',
            }}>{m.label(s)}</button>
          ))}
        </div>
      </div>

      {results.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
          {s.noPayroll}
        </div>
      )}

      {results.map(r => {
        const isExpanded = expanded === r.employee.id;
        const showD = mode !== 'none', showT = mode === 'full';

        return (
          <div key={r.employee.id} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <button onClick={() => setExpanded(isExpanded ? null : r.employee.id)} style={{
              width: '100%', background: 'none', border: 'none',
              padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
              textAlign: 'left', cursor: 'pointer',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14, color: '#fff',
              }}>
                {r.employee.name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{r.employee.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                  {r.daysWorked} {s.days} · {r.totalHours}h · {r.employee.hourlyRate} {s.perHour}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: activeMode.color }}>{r.netPay.toFixed(2)} €</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.netLabel}</div>
              </div>
              <ChevronDown size={18} color="var(--text3)" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>

            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px' }} className="fade-in">
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : `repeat(${showD ? (showT ? 6 : 5) : 2},1fr)`, gap: 12, marginBottom: 14 }}>
                  <Item label={s.rowGross}      value={`+${r.grossPay.toFixed(2)} €`}       color="#10b981" />
                  {showD && <>
                    <Item label={s.rowMio1}     value={`−${r.mio1.toFixed(2)} €`}           color="#ef4444" />
                    <Item label={s.rowMio2}     value={`−${r.mio2.toFixed(2)} €`}           color="#ef4444" />
                  </>}
                  {showT && <Item label={s.rowIncomeTax} value={`−${r.incomeTax.toFixed(2)} €`} color="#f97316" />}
                  {showD && <Item label={s.rowDeductions} value={`−${r.totalDeductions.toFixed(2)} €`} color="#f87171" />}
                  <Item label={s.rowNet}        value={`${r.netPay.toFixed(2)} €`}           color={activeMode.color} large />
                </div>

                <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 14 }}>
                  {s.rowHealth}: {r.healthInsurance.toFixed(2)} € — {s.healthNote}
                </div>

                {r.entries.sort((a: TimeEntry, b: TimeEntry) => a.date.localeCompare(b.date)).map((entry: TimeEntry) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{entry.date}</div>
                      <div style={{ color: 'var(--text2)' }}>{entry.clockIn} → {entry.clockOut}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: entry.hoursWorked < 8 ? '#fb923c' : '#10b981' }}>{entry.hoursWorked}h</div>
                      <div style={{ fontSize: 12, color: '#10b981' }}>{(entry.hoursWorked * r.employee.hourlyRate).toFixed(2)} €</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Item({ label, value, color, large }: { label: string; value: string; color: string; large?: boolean }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: large ? 17 : 15, fontWeight: large ? 800 : 700, color }}>{value}</div>
    </div>
  );
}
