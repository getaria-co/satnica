export interface Employee {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
  sssNumber?: string;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  clockIn: string; // HH:MM
  clockOut: string; // HH:MM
  hoursWorked: number;
  note?: string;
}

export type DeductionMode = 'full' | 'pension' | 'none';

export interface PayrollResult {
  employee: Employee;
  period: string;
  daysWorked: number;
  totalHours: number;
  grossPay: number;
  mio1: number;
  mio2: number;
  healthInsurance: number;
  incomeTax: number;
  totalDeductions: number;
  netPay: number;
  mode: DeductionMode;
  entries: TimeEntry[];
}
