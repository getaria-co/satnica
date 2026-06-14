import { useState } from 'react';

export type BreakType = 'kratka' | 'pauza';
export type ShiftStatus = 'idle' | 'working' | 'kratka' | 'pauza';

export interface BreakLog {
  type: BreakType;
  start: string; // HH:MM
  end?: string;
}

export interface ActiveClock {
  employeeId: string;
  date: string;
  clockIn: string;
  status: ShiftStatus;
  breaks: BreakLog[];
}

const KEY = 'satnica_active_clock';
const MY_KEY = 'satnica_my_employee';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getMyEmployeeId(): string { return localStorage.getItem(MY_KEY) ?? ''; }
export function setMyEmployeeId(id: string) { localStorage.setItem(MY_KEY, id); }

export function getActiveClock(): ActiveClock | null {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

function save(entry: ActiveClock) {
  localStorage.setItem(KEY, JSON.stringify(entry));
  return entry;
}

export function useActiveClock() {
  const [active, setActive] = useState<ActiveClock | null>(getActiveClock);

  function update(fn: (prev: ActiveClock) => ActiveClock) {
    const current = getActiveClock();
    if (!current) return;
    const next = fn(current);
    save(next);
    setActive({ ...next });
  }

  function clockIn(employeeId: string) {
    const d = new Date();
    const entry: ActiveClock = {
      employeeId,
      date: d.toISOString().split('T')[0],
      clockIn: nowTime(),
      status: 'working',
      breaks: [],
    };
    save(entry);
    setActive(entry);
    return entry;
  }

  function startBreak(type: BreakType) {
    update(prev => ({
      ...prev,
      status: type,
      breaks: [...prev.breaks, { type, start: nowTime() }],
    }));
  }

  function endBreak() {
    update(prev => {
      const breaks = [...prev.breaks];
      const last = breaks[breaks.length - 1];
      if (last && !last.end) last.end = nowTime();
      return { ...prev, status: 'working', breaks };
    });
  }

  function clockOut() {
    const current = getActiveClock();
    localStorage.removeItem(KEY);
    setActive(null);
    return current;
  }

  return { active, clockIn, startBreak, endBreak, clockOut };
}
