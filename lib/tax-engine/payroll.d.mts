export interface PensionBreakdown {
  base: number;
  tier2: number;
  total: number;
}
export interface PayrollBreakdown {
  pension: PensionBreakdown;
  ei: number;
  qpip: number;
  total: number;
}
export function pension(income: number, province: string): PensionBreakdown;
export function eiPremium(income: number, province: string): number;
export function qpipPremium(income: number, province: string): number;
export function payroll(income: number, province: string): PayrollBreakdown;
