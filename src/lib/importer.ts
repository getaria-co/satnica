import * as XLSX from 'xlsx';
import type { TimeEntry } from '../types';

export interface ParsedEmployee {
  name: string;
  entries: Omit<TimeEntry, 'id' | 'employeeId'>[];
}

export interface ImportResult {
  employees: ParsedEmployee[];
  warnings: string[];
}

// Parse datetime strings like "06-05-26 07:15" or "2026-05-06 07:15" or "06.05.2026 07:15"
function parseDateTime(raw: string): { date: string; time: string } | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // Try formats: DD-MM-YY HH:MM, DD-MM-YYYY HH:MM, YYYY-MM-DD HH:MM, DD.MM.YYYY HH:MM
  const patterns = [
    /^(\d{2})-(\d{2})-(\d{2,4})\s+(\d{2}):(\d{2})/,  // DD-MM-YY or DD-MM-YYYY
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/,     // YYYY-MM-DD
    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/,   // DD.MM.YYYY
  ];

  for (const pat of patterns) {
    const m = s.match(pat);
    if (!m) continue;

    let year: number, month: number, day: number, hour: number, min: number;

    if (pat === patterns[1]) {
      // YYYY-MM-DD
      [, year, month, day, hour, min] = m.map(Number) as number[];
    } else if (pat === patterns[2]) {
      // DD.MM.YYYY
      [, day, month, year, hour, min] = m.map(Number) as number[];
    } else {
      // DD-MM-YY or DD-MM-YYYY
      [, day, month, year, hour, min] = m.map(Number) as number[];
      if (year < 100) year += 2000;
    }

    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    return { date, time };
  }
  return null;
}

function calcHours(clockIn: string, clockOut: string): number {
  const [ih, im] = clockIn.split(':').map(Number);
  const [oh, om] = clockOut.split(':').map(Number);
  return Math.round(((oh * 60 + om) - (ih * 60 + im)) / 60 * 100) / 100;
}

// Detect if a cell value looks like an employee name (non-empty string, not a number, not "Total")
function isEmployeeName(val: unknown): boolean {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  if (!s || s.toLowerCase() === 'total' || s.toLowerCase() === 'ukupno') return false;
  if (/^\d+$/.test(s)) return false;
  return s.length > 2;
}

export function parseSpreadsheet(buffer: ArrayBuffer): ImportResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const result: ImportResult = { employees: [], warnings: [] };
  let currentEmployee: ParsedEmployee | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c)) continue;

    // Find employee name — scan cols 0–3 for a name-like value
    let empNameCol = -1;
    let empName = '';
    for (let c = 0; c <= Math.min(3, row.length - 1); c++) {
      if (isEmployeeName(row[c])) {
        empNameCol = c;
        empName = String(row[c]).trim();
        break;
      }
    }

    if (empName) {
      // This row introduces a new employee (may also be a "Total" row)
      currentEmployee = { name: empName, entries: [] };
      result.employees.push(currentEmployee);
      // Try to parse the rest of this row as a time entry too (some formats have data on the name row)
    }

    if (!currentEmployee) continue;

    // Look for datetime pair in the row — scan all cells for clock-in/out pattern
    const datetimes: { date: string; time: string }[] = [];
    for (const cell of row) {
      const parsed = parseDateTime(String(cell));
      if (parsed) datetimes.push(parsed);
    }

    if (datetimes.length >= 2) {
      const clockIn = datetimes[0].time;
      const clockOut = datetimes[1].time;
      const date = datetimes[0].date;
      const hoursWorked = calcHours(clockIn, clockOut);

      if (hoursWorked > 0 && hoursWorked <= 24) {
        // Avoid duplicate entries (same employee + date)
        const already = currentEmployee.entries.some(e => e.date === date);
        if (!already) {
          currentEmployee.entries.push({ date, clockIn, clockOut, hoursWorked });
        }
      }
    }
  }

  // Remove employees with no entries
  result.employees = result.employees.filter(e => e.entries.length > 0);

  if (result.employees.length === 0) {
    result.warnings.push('No time entries could be detected. Make sure the file contains clock-in and clock-out times.');
  }

  return result;
}
