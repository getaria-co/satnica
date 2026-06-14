import { useState, useRef, useCallback } from 'react';
import type { Employee } from '../types';
import type { Strings } from '../lib/i18n';
import { parseSpreadsheet, type ParsedEmployee } from '../lib/importer';
import { saveEntry } from '../lib/storage';

interface Props { employees: Employee[]; onRefresh: () => void; s: Strings; }
type MatchMap = Record<string, string>;

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function Import({ employees, onRefresh, s }: Props) {
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedEmployee[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [matchMap, setMatchMap] = useState<MatchMap>({});
  const [imported, setImported] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    setError(''); setParsed(null); setImported(false);
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { setError('Please upload an .xlsx, .xls or .csv file.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const result = parseSpreadsheet(e.target!.result as ArrayBuffer);
        setParsed(result.employees);
        setWarnings(result.warnings);
        const map: MatchMap = {};
        for (const pe of result.employees) {
          const exact = employees.find(emp => emp.name.toLowerCase() === pe.name.toLowerCase());
          const partial = employees.find(emp =>
            emp.name.toLowerCase().includes(pe.name.split(' ')[0].toLowerCase()) ||
            pe.name.toLowerCase().includes(emp.name.split(' ')[0].toLowerCase())
          );
          map[pe.name] = exact?.id ?? partial?.id ?? 'skip';
        }
        setMatchMap(map);
      } catch { setError('Could not read the file. Make sure it is a valid spreadsheet.'); }
    };
    reader.readAsArrayBuffer(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [employees]);

  function handleImport() {
    if (!parsed) return;
    setImporting(true);
    for (const pe of parsed) {
      const empId = matchMap[pe.name];
      if (!empId || empId === 'skip') continue;
      for (const entry of pe.entries) {
        saveEntry({ id: genId(), employeeId: empId, ...entry });
      }
    }
    onRefresh(); setImporting(false); setImported(true); setParsed(null);
  }

  const inputSt: React.CSSProperties = { background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontSize: 13 };
  const matchedPeople = parsed?.filter(p => matchMap[p.name] && matchMap[p.name] !== 'skip') ?? [];
  const importCount = matchedPeople.reduce((s, p) => s + p.entries.length, 0);
  const totalEntries = parsed?.reduce((s, p) => s + p.entries.length, 0) ?? 0;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Import Spreadsheet</h1>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>
        Upload your existing timesheet (.xlsx, .xls, .csv) — Satnica will detect employee names, clock-in and clock-out times automatically.
      </p>

      {!parsed && !imported && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#2563eb' : 'var(--border)'}`,
            borderRadius: 12, padding: 60, textAlign: 'center', cursor: 'pointer',
            background: dragging ? '#1e3a8a22' : 'var(--surface)', marginBottom: 20,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Drop your spreadsheet here</div>
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>or click to browse — .xlsx, .xls, .csv supported</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
        </div>
      )}

      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: 8, padding: 14, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>}
      {warnings.map((w, i) => <div key={i} style={{ background: '#451a03', border: '1px solid #ea580c', borderRadius: 8, padding: 14, color: '#fdba74', fontSize: 13, marginBottom: 10 }}>⚠ {w}</div>)}

      {parsed && parsed.length > 0 && (
        <div>
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 32 }}>
            <Stat label="Employees detected" value={parsed.length} color="#2563eb" />
            <Stat label="Total entries" value={totalEntries} color="#22c55e" />
            <Stat label="Ready to import" value={importCount} color="#eab308" />
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Employee Matching
          </div>

          {parsed.map(pe => (
            <div key={pe.name} style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: matchMap[pe.name] !== 'skip' ? 10 : 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{pe.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {pe.entries.length} entries · {pe.entries[0]?.date} → {pe.entries[pe.entries.length - 1]?.date}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Map to:</span>
                  <select value={matchMap[pe.name] ?? 'skip'} onChange={e => setMatchMap(m => ({ ...m, [pe.name]: e.target.value }))} style={inputSt}>
                    <option value="skip">— Skip —</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
              </div>

              {matchMap[pe.name] !== 'skip' && (
                <div style={{ background: 'var(--surface2)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 10, padding: '7px 12px', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <div>Date</div><div>Clock In</div><div>Clock Out</div><div>Hours</div>
                  </div>
                  {pe.entries.slice(0, 5).map((entry, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 10, padding: '7px 12px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
                      <div style={{ color: 'var(--text2)' }}>{entry.date}</div>
                      <div>{entry.clockIn}</div>
                      <div>{entry.clockOut}</div>
                      <div style={{ color: entry.hoursWorked < 8 ? '#fb923c' : '#22c55e', fontWeight: 600 }}>{entry.hoursWorked}h</div>
                    </div>
                  ))}
                  {pe.entries.length > 5 && <div style={{ padding: '7px 12px', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>+ {pe.entries.length - 5} more entries</div>}
                </div>
              )}
            </div>
          ))}

          {employees.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#ea580c' }}>⚠ No employees in roster yet. Add them in the Employees tab first.</div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button onClick={handleImport} disabled={importing || importCount === 0}
              style={{ background: importCount > 0 ? 'var(--accent)' : 'var(--surface)', color: importCount > 0 ? '#fff' : 'var(--text4)', border: 'none', borderRadius: 8, padding: '11px 24px', fontWeight: 700, fontSize: 14, cursor: importCount > 0 ? 'pointer' : 'not-allowed' }}>
              {importing ? 'Importing...' : `Import ${importCount} entries`}
            </button>
            <button onClick={() => { setParsed(null); setWarnings([]); setError(''); }}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '11px 20px', fontWeight: 600, fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {imported && (
        <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 10, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#4ade80', marginBottom: 4 }}>Import successful</div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>All entries added. Check Time Entry or Payroll to verify.</div>
          <button onClick={() => { setImported(false); setWarnings([]); }}
            style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13 }}>
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
