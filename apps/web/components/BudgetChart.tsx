'use client';

import { formatEth, type SpendConsistency } from '../lib/results';

interface BudgetChartProps {
  budgetWei: bigint;
  spentWei: bigint;
  refundWei: bigint;
  consistency: SpendConsistency;
}

export function BudgetChart({
  budgetWei,
  spentWei,
  refundWei,
  consistency,
}: BudgetChartProps) {
  const budget = Number(budgetWei);
  const spentWidth = budget > 0 ? `${Math.min((Number(spentWei) / budget) * 100, 100)}%` : '0%';
  const refundWidth = budget > 0 ? `${Math.min((Number(refundWei) / budget) * 100, 100)}%` : '0%';
  const summaryText =
    consistency.kind === 'reconciled'
      ? 'Spend totals reconciled'
      : `Audit total differs from task spend by ${formatEth(consistency.deltaWei)}`;

  return (
    <section
      style={{
        background: '#0f172a',
        borderRadius: '12px',
        border: `1px solid ${consistency.kind === 'reconciled' ? '#1d4ed8' : '#991b1b'}`,
        padding: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Summary</h2>
          <p style={{ margin: '0.35rem 0 0', color: consistency.kind === 'reconciled' ? '#93c5fd' : '#fca5a5' }}>
            {summaryText}
          </p>
        </div>
        {refundWei > BigInt(0) && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Refund due
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4ade80' }}>{formatEth(refundWei)}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Budget
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>{formatEth(budgetWei)}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Spent
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>{formatEth(spentWei)}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Remaining
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>{formatEth(refundWei)}</div>
        </div>
      </div>

      <div style={{ marginTop: '1rem', overflow: 'hidden', borderRadius: '999px', background: '#111827', height: '0.75rem' }}>
        <div
          style={{
            width: spentWidth,
            background: '#60a5fa',
            height: '100%',
            borderRadius: refundWei > BigInt(0) ? '999px 0 0 999px' : '999px',
          }}
        />
      </div>
      {refundWei > BigInt(0) && (
        <div style={{ marginTop: '0.35rem', overflow: 'hidden', borderRadius: '999px', background: '#111827', height: '0.5rem' }}>
          <div style={{ width: refundWidth, background: '#22c55e', height: '100%', borderRadius: '999px' }} />
        </div>
      )}
    </section>
  );
}
