import { useState } from 'react';
import { Calculator, ArrowLeftRight } from 'lucide-react';
import type { Strings } from '../lib/i18n';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props { s: Strings; }

const MIO1 = 0.15;
const MIO2 = 0.05;
const HEALTH = 0.165;
const TAX = 0.20;
const ALLOWANCE = 560;

function r2(n: number) { return Math.round(n * 100) / 100; }

function calcFromGross(gross: number) {
  const mio1 = r2(gross * MIO1);
  const mio2 = r2(gross * MIO2);
  const health = r2(gross * HEALTH);
  const taxBase = Math.max(0, gross - mio1 - mio2 - ALLOWANCE);
  const incomeTax = r2(taxBase * TAX);
  return {
    gross,
    mio1, mio2, health, incomeTax,
    full: { net: r2(gross - mio1 - mio2 - incomeTax), deductions: r2(mio1 + mio2 + incomeTax) },
    pension: { net: r2(gross - mio1 - mio2), deductions: r2(mio1 + mio2) },
    none: { net: gross, deductions: 0 },
  };
}

// Reverse: given desired net under 'full' mode, find required gross via iteration
function grossFromNet(net: number, mode: 'full' | 'pension' | 'none'): number {
  if (mode === 'none') return net;
  let lo = net, hi = net * 3, gross = net * 1.3;
  for (let i = 0; i < 60; i++) {
    const c = calcFromGross(gross);
    const result = mode === 'full' ? c.full.net : c.pension.net;
    if (Math.abs(result - net) < 0.001) break;
    if (result < net) lo = gross; else hi = gross;
    gross = (lo + hi) / 2;
  }
  return r2(gross);
}

const fmt = (n: number) => n.toFixed(2);

export default function SalaryCalc({ s }: Props) {
  const isMobile = useIsMobile();
  const [input, setInput] = useState('');
  const [reverse, setReverse] = useState(false);

  const raw = parseFloat(input);
  const valid = !isNaN(raw) && raw > 0;

  const calc = valid
    ? (reverse
        ? (() => {
            const gFull    = grossFromNet(raw, 'full');
            const gPension = grossFromNet(raw, 'pension');
            const gNone    = grossFromNet(raw, 'none');
            return {
              full:    calcFromGross(gFull),
              pension: calcFromGross(gPension),
              none:    calcFromGross(gNone),
            };
          })()
        : (() => {
            const c = calcFromGross(raw);
            return { full: c, pension: c, none: c };
          })()
      )
    : null;

  const cols: { key: 'full' | 'pension' | 'none'; label: string; color: string; bg: string; }[] = [
    { key: 'full',    label: s.modeFull,    color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    { key: 'pension', label: s.modePension, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
    { key: 'none',    label: s.modeNone,    color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="s-page-title" style={{ margin: 0 }}>{s.calcTitle}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>{s.calcSub}</p>
        </div>
        <button
          onClick={() => setReverse(r => !r)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border2)',
            background: reverse ? 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(59,130,246,0.15))' : 'var(--surface2)',
            color: reverse ? 'var(--accent)' : 'var(--text2)',
            fontWeight: 600, fontSize: 13,
          }}
        >
          <ArrowLeftRight size={14} />
          {reverse ? s.calcModeReverse : s.calcModeForward}
        </button>
      </div>

      {/* Input */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow)' }}>
        <label className="s-label" style={{ marginBottom: 8, display: 'block' }}>
          {reverse ? s.calcInputNet : s.calcInputGross}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={reverse ? '1200.00' : '1500.00'}
              className="s-input"
              style={{ paddingRight: 36, fontSize: 18, fontWeight: 700 }}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 16, fontWeight: 700, color: 'var(--text3)',
            }}>€</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 12,
            background: valid ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : 'var(--surface2)',
            boxShadow: valid ? '0 4px 14px rgba(59,130,246,0.35)' : 'none',
          }}>
            <Calculator size={18} color={valid ? '#fff' : 'var(--text4)'} />
          </div>
        </div>
        {reverse && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text3)' }}>{s.calcReverseNote}</p>
        )}
      </div>

      {/* Results — 3 columns */}
      {calc && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
          gap: 14,
        }}>
          {cols.map(({ key, label, color, bg }) => {
            const data = calc[key];
            const gross = data.gross;
            const net = data[key].net;
            const deductions = data[key].deductions;
            const isFull = key === 'full';

            return (
              <div key={key} style={{
                background: 'var(--surface)', borderRadius: 16,
                border: `1px solid ${color}30`,
                overflow: 'hidden', boxShadow: 'var(--shadow)',
              }} className="fade-in">
                {/* Header */}
                <div style={{ background: bg, borderBottom: `1px solid ${color}20`, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>
                    {fmt(net)} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text3)' }}>€</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.rowNet}</div>
                </div>

                {/* Breakdown */}
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Row label={s.rowGross} value={fmt(gross)} color="var(--text2)" />
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <Row label={`${s.rowMio1}`} value={`−${fmt(data.mio1)}`} color="#f59e0b" dim={key === 'none'} />
                  <Row label={`${s.rowMio2}`} value={`−${fmt(data.mio2)}`} color="#f97316" dim={key === 'none'} />
                  <Row label={s.rowHealth} value={`${fmt(data.health)}`} color="var(--text4)" note={s.calcHealthNote} />
                  <Row
                    label={s.rowIncomeTax}
                    value={isFull ? `−${fmt(data.incomeTax)}` : '—'}
                    color={isFull ? '#ef4444' : 'var(--text4)'}
                    dim={!isFull}
                  />
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <Row
                    label={s.rowDeductions}
                    value={`−${fmt(deductions)}`}
                    color={color}
                    bold
                  />
                  <div style={{
                    background: bg, borderRadius: 10, padding: '8px 12px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{s.rowNet}</span>
                    <span style={{ fontSize: 17, fontWeight: 800, color }}>{fmt(net)} €</span>
                  </div>

                  {/* Effective rate */}
                  {deductions > 0 && gross > 0 && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text4)', marginTop: 2 }}>
                      {s.calcEffRate} {((deductions / gross) * 100).toFixed(1)}%
                    </div>
                  )}

                  {/* Reverse note */}
                  {reverse && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {s.calcRequiresGross} {fmt(gross)} €
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!valid && (
        <div style={{
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          padding: 40, textAlign: 'center', color: 'var(--text3)',
        }}>
          <Calculator size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 14 }}>{s.calcEmpty}</div>
        </div>
      )}

      {/* Allowance note */}
      {valid && (
        <div style={{
          background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)',
          padding: '10px 14px', fontSize: 12, color: 'var(--text3)',
        }}>
          ℹ️ {s.calcAllowanceNote}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color, dim, bold, note }: {
  label: string; value: string; color: string;
  dim?: boolean; bold?: boolean; note?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: dim ? 'var(--text4)' : 'var(--text3)', fontWeight: bold ? 700 : 400 }}>
        {label}{note && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--text4)' }}>({note})</span>}
      </span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: dim ? 'var(--text4)' : color, opacity: dim ? 0.5 : 1 }}>
        {value}
      </span>
    </div>
  );
}
