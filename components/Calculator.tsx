'use client';

import { useMemo, useState } from 'react';
import { getFederalTax, getProvincialTax, getMarginalRate, PROVINCE_CODES } from '../lib/tax-engine/calculate.mjs';
import { payroll } from '../lib/tax-engine/payroll.mjs';

const fmt = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 });

export default function Calculator() {
  const [income, setIncome] = useState(85000);
  const [province, setProvince] = useState('ON');

  const r = useMemo(() => {
    const fed = getFederalTax(province, income);
    const prv = getProvincialTax(province, income);
    const pay = payroll(income, province);
    const taxTotal = fed + prv;
    const net = income - taxTotal - pay.total;
    return { fed, prv, pay, taxTotal, net, marginal: getMarginalRate(province, income) };
  }, [income, province]);

  const compare = useMemo(
    () =>
      PROVINCE_CODES.map((p) => {
        const fed = getFederalTax(p, income);
        const prv = getProvincialTax(p, income);
        const pay = payroll(income, p);
        return { p, net: income - fed - prv - pay.total };
      }).sort((a, b) => b.net - a.net),
    [income]
  );

  const total = Math.max(income, 1);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 16px 0' }}>
      <h1 style={{ fontSize: 48, letterSpacing: -0.5, lineHeight: 1.1, margin: 0 }}>
        How much tax will you actually pay?
      </h1>
      <p style={{ color: 'var(--slate)', fontSize: 18 }}>2026 Canada-first estimate. Anonymous — nothing leaves your browser.</p>

      <label htmlFor="income" style={{ display: 'block', fontWeight: 600, marginTop: 32 }}>
        Employment income: {fmt(income)}
      </label>
      <input
        id="income"
        type="range"
        min={0}
        max={300000}
        step={1000}
        value={Math.min(income, 300000)}
        onChange={(e) => setIncome(Number(e.target.value))}
        style={{ width: '100%' }}
      />
      <input
        type="number"
        aria-label="Exact income"
        min={0}
        value={income}
        onChange={(e) => setIncome(Math.max(0, Number(e.target.value) || 0))}
        style={{ fontSize: 16, padding: 8, border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)', marginTop: 8 }}
      />

      <label htmlFor="province" style={{ display: 'block', fontWeight: 600, marginTop: 24 }}>
        Province / territory
      </label>
      <select
        id="province"
        value={province}
        onChange={(e) => setProvince(e.target.value)}
        style={{ fontSize: 16, padding: 8, border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)' }}
      >
        {PROVINCE_CODES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', height: 28, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginTop: 32 }}>
        <span style={{ width: `${(r.prv / total) * 100}%`, background: '#ff7759' }} />
        <span style={{ width: `${(r.fed / total) * 100}%`, background: 'var(--action-blue)' }} />
        <span style={{ width: `${(Math.max(r.net, 0) / total) * 100}%`, background: 'var(--soft-stone)', border: '1px solid var(--hairline)' }} />
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px', marginTop: 24, fontSize: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
          <dt>Federal tax</dt><dd style={{ fontWeight: 700 }}>{fmt(r.fed)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
          <dt>Provincial tax</dt><dd style={{ fontWeight: 700 }}>{fmt(r.prv)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
          <dt>Income tax total</dt><dd style={{ fontWeight: 700 }}>{fmt(r.taxTotal)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
          <dt>CPP / QPP + EI{province === 'QC' ? ' + QPIP' : ''}</dt><dd style={{ fontWeight: 700 }}>{fmt(r.pay.total)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
          <dt>Take-home (annual)</dt><dd style={{ fontWeight: 700 }}>{fmt(r.net)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
          <dt>Take-home (monthly)</dt><dd style={{ fontWeight: 700 }}>{fmt(r.net / 12)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
          <dt>Marginal rate</dt><dd style={{ fontWeight: 700 }}>{(r.marginal * 100).toFixed(2)}%</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
          <dt>Average rate</dt><dd style={{ fontWeight: 700 }}>{income ? ((r.taxTotal / income) * 100).toFixed(2) : '0.00'}%</dd>
        </div>
      </dl>

      <h2 style={{ fontSize: 24, marginTop: 48 }}>What if you lived elsewhere?</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--slate)' }}>
            <th>Province</th><th>Take-home</th><th>vs {province}</th>
          </tr>
        </thead>
        <tbody>
          {compare.map(({ p, net }) => {
            const self = compare.find((c) => c.p === province)!;
            return (
              <tr key={p} style={{ borderTop: '1px solid var(--hairline)', fontWeight: p === province ? 700 : 400 }}>
                <td>{p}</td><td>{fmt(net)}</td><td>{p === province ? '—' : `${net >= self.net ? '+' : '−'}${fmt(Math.abs(net - self.net))}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
