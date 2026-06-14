import type { Employee, TimeEntry } from '../types';

const EMPLOYEES_KEY = 'satnica_employees';
const ENTRIES_KEY = 'satnica_entries';

export function getEmployees(): Employee[] {
  const raw = localStorage.getItem(EMPLOYEES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveEmployee(emp: Employee): void {
  const list = getEmployees().filter(e => e.id !== emp.id);
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify([...list, emp]));
}

export function deleteEmployee(id: string): void {
  const list = getEmployees().filter(e => e.id !== id);
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(list));
}

export function getEntries(): TimeEntry[] {
  const raw = localStorage.getItem(ENTRIES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveEntry(entry: TimeEntry): void {
  const list = getEntries().filter(e => e.id !== entry.id);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify([...list, entry]));
}

export function deleteEntry(id: string): void {
  const list = getEntries().filter(e => e.id !== id);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(list));
}
