import { useState, useRef, useCallback } from 'react';
import { FileSpreadsheet, Image, Scan, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Employee } from '../types';
import type { Strings } from '../lib/i18n';
import { parseSpreadsheet, type ParsedEmployee } from '../lib/importer';
import { saveEntry } from '../lib/storage';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props { employees: Employee[]; onRefresh: () => void; s: Strings; }
type MatchMap = Record<string, string>;
type Mode = 'spreadsheet' | 'image';

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;

async function extractFromImage(base64: string, mimeType: string): Promise<ParsedEmployee[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: `This is a timesheet or work schedule image. Extract all employee time entries you can find.

Return ONLY a JSON array — no explanation, no markdown, no code fences — in this exact format:
[
  {
    "name": "Employee Full Name",
    "entries": [
      { "date": "YYYY-MM-DD", "clockIn": "HH:MM", "clockOut": "HH:MM", "hoursWorked": 8.0 }
    ]
  }
]

Rules:
- dates must be YYYY-MM-DD format
- times must be HH:MM (24h)
- hoursWorked = clockOut minus clockIn as a decimal number
- if you see a name but no clear times, skip that person
- if the image has no time data at all, return []`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  const text = data.content.find(b => b.type === 'text')?.text ?? '[]';

  // Strip markdown fences if Claude wrapped it anyway
  const clean = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(clean) as Array<{
    name: string;
    entries: Array<{ date: string; clockIn: string; clockOut: string; hoursWorked: number }>;
  }>;

  return parsed
    .filter(p => p.name && p.entries?.length > 0)
    .map(p => ({
      name: p.name,
      entries: p.entries.map(e => ({
        date: e.date,
        clockIn: e.clockIn,
        clockOut: e.clockOut,
        hoursWorked: Number(e.hoursWorked),
      })),
    }));
}

function autoMatch(parsed: ParsedEmployee[], employees: Employee[]): MatchMap {
  const map: MatchMap = {};
  for (const pe of parsed) {
    const exact = employees.find(e => e.name.toLowerCase() === pe.name.toLowerCase());
    const partial = employees.find(e =>
      e.name.toLowerCase().includes(pe.name.split(' ')[0].toLowerCase()) ||
      pe.name.toLowerCase().includes(e.name.split(' ')[0].toLowerCase())
    );
    map[pe.name] = exact?.id ?? partial?.id ?? 'skip';
  }
  return map;
}

export default function Import({ employees, onRefresh }: Props) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<Mode>('spreadsheet');

  // Shared state
  const [parsed, setParsed] = useState<ParsedEmployee[] | null>(null);
  const [matchMap, setMatchMap] = useState<MatchMap>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  // Spreadsheet state
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function reset() {
    setParsed(null); setMatchMap({}); setWarnings([]);
    setError(''); setImported(false); setScanned(false);
    setImagePreview(null);
  }

  function switchMode(m: Mode) { reset(); setMode(m); }

  // ── SPREADSHEET ──
  function processSpreadsheet(file: File) {
    reset();
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { setError('Please upload an .xlsx, .xls or .csv file.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const result = parseSpreadsheet(e.target!.result as ArrayBuffer);
        setParsed(result.employees);
        setWarnings(result.warnings);
        setMatchMap(autoMatch(result.employees, employees));
      } catch { setError('Could not read the file. Make sure it is a valid spreadsheet.'); }
    };
    reader.readAsArrayBuffer(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processSpreadsheet(file);
  }, [employees]);

  // ── IMAGE ──
  function loadImageFile(file: File) {
    reset();
    if (!file.type.startsWith('image/')) { setError('Please select an image file (JPG, PNG, WEBP).'); return; }
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target!.result as string);
    reader.readAsDataURL(file);
  }

  async function runScan() {
    if (!imagePreview) return;
    if (!API_KEY) { setError('No Anthropic API key configured.'); return; }
    setScanning(true); setError('');
    try {
      const base64 = imagePreview.split(',')[1];
      const result = await extractFromImage(base64, imageMime);
      if (result.length === 0) {
        setWarnings(['No time entries could be detected in this image. Try a clearer photo.']);
      }
      setParsed(result);
      setMatchMap(autoMatch(result, employees));
      setScanned(true);
    } catch (err) {
      setError(`AI scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setScanning(false); }
  }

  // ── IMPORT ──
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
    onRefresh(); setImporting(false); setImported(true); setParsed(null); setImagePreview(null);
  }

  const matchedPeople = parsed?.filter(p => matchMap[p.name] && matchMap[p.name] !== 'skip') ?? [];
  const importCount = matchedPeople.reduce((s, p) => s + p.entries.length, 0);
  const totalEntries = parsed?.reduce((s, p) => s + p.entries.length, 0) ?? 0;
  const inputSt: React.CSSProperties = {
    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text)', padding: '6px 10px', fontSize: 13,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div>
        <h1 className="s-page-title" style={{ margin: 0 }}>Import</h1>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          Upload a spreadsheet or a photo of a timesheet — Satnica extracts the data automatically.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{
        display: 'flex', background: 'var(--surface)', borderRadius: 12,
        border: '1px solid var(--border)', padding: 4, gap: 4,
        width: 'fit-content',
      }}>
        {([
          { id: 'spreadsheet', icon: FileSpreadsheet, label: 'Spreadsheet' },
          { id: 'image',       icon: Image,           label: 'Photo / Image' },
        ] as const).map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => switchMode(id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 9, border: 'none',
            fontWeight: 600, fontSize: 13,
            background: mode === id ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : 'transparent',
            color: mode === id ? '#fff' : 'var(--text3)',
            boxShadow: mode === id ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
          }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── SPREADSHEET DROP ZONE ── */}
      {mode === 'spreadsheet' && !parsed && !imported && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 16, padding: isMobile ? 40 : 60,
            textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'rgba(59,130,246,0.06)' : 'var(--surface)',
            transition: 'all 0.15s',
          }}
        >
          <FileSpreadsheet size={36} style={{ marginBottom: 12, opacity: 0.5, color: 'var(--accent)' }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Drop your spreadsheet here</div>
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>or click to browse — .xlsx, .xls, .csv supported</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && processSpreadsheet(e.target.files[0])} />
        </div>
      )}

      {/* ── IMAGE UPLOAD ZONE ── */}
      {mode === 'image' && !imagePreview && !imported && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--border)', padding: isMobile ? 32 : 48,
            textAlign: 'center',
          }}>
            <Image size={36} style={{ marginBottom: 12, opacity: 0.5, color: 'var(--accent)' }} />
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Upload a timesheet photo</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
              JPG, PNG, WEBP — screenshot from WhatsApp, photo of a printed sheet, anything
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => imageRef.current?.click()} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px',
                borderRadius: 10, border: '1px solid var(--border2)',
                background: 'var(--surface2)', color: 'var(--text2)',
                fontWeight: 600, fontSize: 14,
              }}>
                <Image size={15} /> Browse image
              </button>
              {isMobile && (
                <button onClick={() => cameraRef.current?.click()} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px',
                  borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
                  color: '#fff', fontWeight: 600, fontSize: 14,
                  boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                }}>
                  📷 Take photo
                </button>
              )}
            </div>
            <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && loadImageFile(e.target.files[0])} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && loadImageFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {/* ── IMAGE PREVIEW + SCAN ── */}
      {mode === 'image' && imagePreview && !imported && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {/* Image */}
            <div style={{ position: 'relative' }}>
              <img
                src={imagePreview}
                alt="Timesheet"
                style={{ width: '100%', maxHeight: 320, objectFit: 'contain', display: 'block', background: '#000' }}
              />
              <button onClick={reset} style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 8,
                color: '#fff', padding: 6, display: 'flex', alignItems: 'center',
              }}>
                <X size={16} />
              </button>
              {scanned && (
                <div style={{
                  position: 'absolute', top: 10, left: 10,
                  background: 'rgba(16,185,129,0.9)', borderRadius: 8,
                  padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <CheckCircle2 size={13} /> Scanned
                </div>
              )}
            </div>

            {/* Scan button */}
            {!scanned && (
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={runScan}
                  disabled={scanning}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '13px 0', borderRadius: 10, border: 'none',
                    background: scanning ? 'var(--surface2)' : 'linear-gradient(135deg,var(--accent),var(--accent2))',
                    color: scanning ? 'var(--text3)' : '#fff',
                    fontWeight: 700, fontSize: 15,
                    boxShadow: scanning ? 'none' : '0 4px 16px rgba(59,130,246,0.4)',
                  }}
                >
                  <Scan size={18} style={scanning ? { animation: 'spin-slow 1.5s linear infinite' } : {}} />
                  {scanning ? 'AI is reading the image...' : 'Scan with AI'}
                </button>
                <p style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
                  Uses Claude vision to extract names, dates, and clock-in/out times
                </p>
              </div>
            )}

            {scanned && parsed && parsed.length === 0 && (
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>
                  No time entries detected. Try a clearer image or a closer crop.
                </div>
                <button onClick={reset} style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text2)', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13,
                }}>Try another image</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ERRORS & WARNINGS ── */}
      {error && (
        <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid #dc2626', borderRadius: 10, padding: 14, color: '#fca5a5', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}
      {warnings.map((w, i) => (
        <div key={i} style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid #ea580c', borderRadius: 10, padding: 14, color: '#fdba74', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
        </div>
      ))}

      {/* ── PARSED RESULTS ── */}
      {parsed && parsed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Stats */}
          <div style={{
            background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
            padding: '14px 20px', display: 'flex', gap: isMobile ? 20 : 40, flexWrap: 'wrap',
          }}>
            <Stat label="Detected" value={parsed.length} unit="people" color="var(--accent)" />
            <Stat label="Total entries" value={totalEntries} unit="rows" color="#8b5cf6" />
            <Stat label="Ready to import" value={importCount} unit="entries" color="#10b981" />
            {mode === 'image' && imagePreview && (
              <div style={{ marginLeft: 'auto' }}>
                <img src={imagePreview} alt="ref" style={{ height: 44, borderRadius: 6, opacity: 0.7 }} />
              </div>
            )}
          </div>

          {/* Employee matching */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Employee Matching
          </div>

          {parsed.map(pe => (
            <div key={pe.name} style={{
              background: 'var(--surface)', borderRadius: 14,
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontWeight: 700 }}>{pe.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {pe.entries.length} entries · {pe.entries[0]?.date} → {pe.entries[pe.entries.length - 1]?.date}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Map to:</span>
                  <select
                    value={matchMap[pe.name] ?? 'skip'}
                    onChange={e => setMatchMap(m => ({ ...m, [pe.name]: e.target.value }))}
                    style={inputSt}
                  >
                    <option value="skip">— Skip —</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
              </div>

              {matchMap[pe.name] !== 'skip' && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 72px', padding: '7px 16px', fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <span>Date</span><span>In</span><span>Out</span><span>Hours</span>
                  </div>
                  {pe.entries.slice(0, 5).map((entry, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 72px', padding: '7px 16px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text2)' }}>{entry.date}</span>
                      <span>{entry.clockIn}</span>
                      <span>{entry.clockOut}</span>
                      <span style={{ fontWeight: 700, color: entry.hoursWorked < 8 ? '#fb923c' : '#22c55e' }}>{entry.hoursWorked}h</span>
                    </div>
                  ))}
                  {pe.entries.length > 5 && (
                    <div style={{ padding: '7px 16px', fontSize: 11, color: 'var(--text4)', borderTop: '1px solid var(--border)' }}>
                      + {pe.entries.length - 5} more entries
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {employees.length === 0 && (
            <div style={{ fontSize: 12, color: '#ea580c', display: 'flex', gap: 6, alignItems: 'center' }}>
              <AlertTriangle size={13} /> No employees in roster yet — add them in the Employees tab first.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            <button
              onClick={handleImport}
              disabled={importing || importCount === 0}
              className="s-btn"
              style={{ opacity: importCount === 0 ? 0.4 : 1 }}
            >
              {importing ? 'Importing...' : `Import ${importCount} ${importCount === 1 ? 'entry' : 'entries'}`}
            </button>
            <button onClick={reset} className="s-btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {imported && (
        <div style={{
          background: 'rgba(16,185,129,0.08)', border: '1px solid #10b981',
          borderRadius: 14, padding: 32, textAlign: 'center',
        }} className="fade-in">
          <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: '#4ade80', marginBottom: 4 }}>Import successful</div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>
            All entries added. Check Time Entry or Payroll to verify.
          </div>
          <button onClick={reset} className="s-btn">Import another</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text4)' }}>{unit}</div>
    </div>
  );
}
