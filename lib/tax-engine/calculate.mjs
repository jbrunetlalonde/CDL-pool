/**
 * Thin wrapper — the ONLY place tax numbers are computed.
 * UI must import from here, never from '@equisoft/tax-ca' directly.
 *
 * Federal: progressive brackets − BPA×14% credit, BPA phases MIN→MAX over
 * $181,440–$258,482. QC federal gets the 16.5% abatement (×0.835).
 * Provincial: progressive brackets − BPA×creditRate. QC BPA never phases out.
 */
import { FEDERAL, PROVINCES, QC_ABATEMENT, ON_SURTAX } from './cra-tables-2026.mjs';

export function bracketTax(income, rates) {
  let tax = 0;
  for (const r of rates) {
    if (income <= r.FROM) break;
    tax += (Math.min(income, r.TO) - r.FROM) * r.RATE;
  }
  return tax;
}

export function federalBPA(income) {
  const { min, max, phaseOutFrom, phaseOutTo } = FEDERAL.BPA;
  if (income <= phaseOutFrom) return max;
  if (income >= phaseOutTo) return min;
  return max - ((income - phaseOutFrom) * (max - min)) / (phaseOutTo - phaseOutFrom);
}

export function getFederalTax(province, income) {
  const gross = bracketTax(income, FEDERAL.RATES);
  const credit = federalBPA(income) * FEDERAL.CREDIT_RATE;
  const net = Math.max(0, gross - credit);
  return province === 'QC' ? net * (1 - QC_ABATEMENT) : net;
}

export function getProvincialTax(province, income) {
  const p = PROVINCES[province];
  if (!p) throw new Error(`Unknown province: ${province}`);
  const gross = bracketTax(income, p.RATES);
  const bpa = typeof p.BPA === 'number' ? p.BPA : p.BPA.max;
  const net = Math.max(0, gross - bpa * p.CREDIT_RATE);
  // Ontario surtax applies to (base − credit), per ON428 structure —
  // verified: mirrors library implementation + catax.tools $6,378 at $100k.
  if (province === 'ON') return net + bracketTax(net, ON_SURTAX);
  return net;
}

export function getTotalTax(province, income) {
  return getFederalTax(province, income) + getProvincialTax(province, income);
}

export function getMarginalRate(province, income) {
  const h = 1;
  return (getTotalTax(province, income + h) - getTotalTax(province, income)) / h;
}

export const PROVINCE_CODES = Object.keys(PROVINCES);
