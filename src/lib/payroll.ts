import type { Employee, TimeEntry, PayrollResult, DeductionMode } from '../types';

const MIO1_RATE = 0.15;
const MIO2_RATE = 0.05;
const HEALTH_RATE = 0.165;       // HZZO — employer contribution, shown for reference only
const INCOME_TAX_RATE = 0.20;
const PERSONAL_ALLOWANCE = 560;  // Monthly personal deduction (osobni odbitak) in EUR

function r2(n: number) { return Math.round(n * 100) / 100; }

export function calcHours(clockIn: string, clockOut: string): number {
  const [inH, inM] = clockIn.split(':').map(Number);
  const [outH, outM] = clockOut.split(':').map(Number);
  const diff = (outH * 60 + outM) - (inH * 60 + inM);
  return r2(diff / 60);
}

export function computePayroll(
  employee: Employee,
  entries: TimeEntry[],
  period: string,
  mode: DeductionMode = 'full'
): PayrollResult {
  const empEntries = entries.filter(e => e.employeeId === employee.id);
  const totalHours = r2(empEntries.reduce((sum, e) => sum + e.hoursWorked, 0));
  const daysWorked = empEntries.length;
  const grossPay = r2(totalHours * employee.hourlyRate);

  const mio1 = mode !== 'none' ? r2(grossPay * MIO1_RATE) : 0;
  const mio2 = mode !== 'none' ? r2(grossPay * MIO2_RATE) : 0;
  const healthInsurance = r2(grossPay * HEALTH_RATE);

  // Income tax: 20% on (gross - MIO I - MIO II - personal allowance), floor at 0
  const taxBase = mode === 'full' ? Math.max(0, grossPay - mio1 - mio2 - PERSONAL_ALLOWANCE) : 0;
  const incomeTax = mode === 'full' ? r2(taxBase * INCOME_TAX_RATE) : 0;

  const totalDeductions = r2(mio1 + mio2 + incomeTax);
  const netPay = r2(grossPay - totalDeductions);

  return {
    employee,
    period,
    daysWorked,
    totalHours,
    grossPay,
    mio1,
    mio2,
    healthInsurance,
    incomeTax,
    totalDeductions,
    netPay,
    mode,
    entries: empEntries,
  };
}
