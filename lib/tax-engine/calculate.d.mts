export interface BracketRate {
  FROM: number;
  TO: number;
  RATE: number;
}
export interface FederalBPA {
  max: number;
  min: number;
  phaseOutFrom: number;
  phaseOutTo: number;
}
export function bracketTax(income: number, rates: BracketRate[]): number;
export function federalBPA(income: number): number;
export function getFederalTax(province: string, income: number): number;
export function getProvincialTax(province: string, income: number): number;
export function getTotalTax(province: string, income: number): number;
export function getMarginalRate(province: string, income: number): number;
export const PROVINCE_CODES: string[];
