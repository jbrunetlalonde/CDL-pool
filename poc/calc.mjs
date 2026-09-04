#!/usr/bin/env node
/**
 * POC CLI — thin shell over lib/tax-engine (no logic here).
 *
 *   node poc/calc.mjs --income 85000 --province ON
 *   node poc/calc.mjs --income 85000 --compare
 *   node poc/calc.mjs --income 85000 --province QC --json
 */
import { getFederalTax, getProvincialTax, getMarginalRate, PROVINCE_CODES } from '../lib/tax-engine/calculate.mjs';
import { payroll } from '../lib/tax-engine/payroll.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) {
      const k = a.slice(2);
      acc.push([k, arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]);
    }
    return acc;
  }, [])
);

const income = Number(args.income ?? 85000);
const province = String(args.province ?? 'ON').toUpperCase();

if (!Number.isFinite(income) || income < 0) {
  console.error('Usage: node poc/calc.mjs --income 85000 --province ON [--compare] [--json]');
  process.exit(1);
}

const fmt = (n) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 });

function resultFor(prov) {
  const fed = getFederalTax(prov, income);
  const prv = getProvincialTax(prov, income);
  const pay = payroll(income, prov);
  const taxTotal = fed + prv;
  const net = income - taxTotal - pay.total;
  return {
    province: prov,
    federal: fed,
    provincial: prv,
    taxTotal,
    cpp: pay.pension.total,
    ei: pay.ei,
    qpip: pay.qpip,
    payrollTotal: pay.total,
    net,
    monthly: net / 12,
    biweekly: net / 26,
    marginal: getMarginalRate(prov, income),
    average: income > 0 ? taxTotal / income : 0,
  };
}

if (args.compare) {
  const rows = PROVINCE_CODES.map(resultFor).sort((a, b) => b.net - a.net);
  if (args.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`$${income.toLocaleString()} income — all provinces ranked by take-home (2026):\n`);
    console.log('Prov | Income tax | Payroll | Take-home |  Monthly | Marginal');
    console.log('-----|------------|---------|-----------|----------|----------');
    for (const r of rows) {
      console.log(
        `${r.province.padEnd(4)} | ${fmt(r.taxTotal).padStart(10)} | ${fmt(r.payrollTotal).padStart(7)} | ${fmt(r.net).padStart(9)} | ${fmt(r.monthly).padStart(8)} | ${(r.marginal * 100).toFixed(2)}%`
      );
    }
  }
} else {
  if (!PROVINCE_CODES.includes(province)) {
    console.error(`Unknown province: ${province} (expected one of ${PROVINCE_CODES.join(' ')})`);
    process.exit(1);
  }
  const r = resultFor(province);
  if (args.json) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(`2026 estimate — $${income.toLocaleString()} in ${province} (informational only):\n`);
    console.log(`  Federal tax:    ${fmt(r.federal)}`);
    console.log(`  Provincial tax: ${fmt(r.provincial)}`);
    console.log(`  Income tax:     ${fmt(r.taxTotal)}`);
    console.log(`  CPP/QPP:        ${fmt(r.cpp)}`);
    console.log(`  EI:             ${fmt(r.ei)}${r.qpip ? `\n  QPIP:           ${fmt(r.qpip)}` : ''}`);
    console.log(`  Take-home:      ${fmt(r.net)}  (${fmt(r.monthly)}/mo, ${fmt(r.biweekly)}/biweekly)`);
    console.log(`  Marginal:       ${(r.marginal * 100).toFixed(2)}%   Average: ${(r.average * 100).toFixed(2)}%`);
  }
}
