/**
 * Employee payroll deductions for 2026 — pure functions, browser-safe.
 * Numbers from data/tax-tables/2026.cra.json (VERIFIED vs CRA payroll tables).
 */
import snapshot from '../../data/tax-tables/2026.cra.json' with { type: 'json' };

const { cpp, qpp, ei, qpip } = snapshot.payroll;

export function pension(income, province) {
  const isQc = province === 'QC';
  const base = isQc ? qpp.base : cpp.base;
  const cpp1 = base * (Math.min(income, cpp.ympe) - Math.min(income, cpp.exempt));
  const cpp2 = cpp.step2 * (Math.min(income, cpp.yampe) - Math.min(income, cpp.ympe));
  return { base: Math.max(0, cpp1), tier2: Math.max(0, cpp2), total: Math.max(0, cpp1 + cpp2) };
}

export function eiPremium(income, province) {
  const rate = province === 'QC' ? ei.rateQc : ei.rate;
  return rate * Math.min(income, ei.mie);
}

export function qpipPremium(income, province) {
  if (province !== 'QC') return 0;
  return qpip.salaried * Math.min(income, qpip.mie);
}

export function payroll(income, province) {
  const pen = pension(income, province);
  const eiAmt = eiPremium(income, province);
  const qpipAmt = qpipPremium(income, province);
  return { pension: pen, ei: eiAmt, qpip: qpipAmt, total: pen.total + eiAmt + qpipAmt };
}
