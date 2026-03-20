'use client';

import { formatEth, type AuditEntry, type SpendTotals } from '../lib/results';

interface AuditPanelProps {
  entries: AuditEntry[];
  totals: SpendTotals;
}

export function AuditPanel({ entries, totals }: AuditPanelProps) {
  return (
    <section
      style={{
        background: '#020617',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        padding: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Audit Trail</h2>
          <p style={{ margin: '0.5rem 0 0', color: '#94a3b8' }}>
            Premium, direct, and LLM spend entries reconciled into one total.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Audit Total
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{formatEth(totals.totalWei)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '1rem' }}>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Treasury
          </div>
          <div>{formatEth(totals.byPath.TREASURY)}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Direct
          </div>
          <div>{formatEth(totals.byPath.DIRECT_MPP)}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            LLM
          </div>
          <div>{formatEth(totals.byPath.LLM)}</div>
        </div>
      </div>

      {entries.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b' }}>No spend entries were recorded for this task.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                borderRadius: '10px',
                border: '1px solid #1e293b',
                background: '#0f172a',
                padding: '0.9rem 1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{entry.message}</div>
                  <div style={{ marginTop: '0.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                    {entry.serviceId} · {entry.path} · query #{entry.queryIndex}
                  </div>
                  {entry.memo && (
                    <div style={{ marginTop: '0.25rem', color: '#64748b', fontSize: '0.8rem' }}>
                      memo: {entry.memo}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{formatEth(entry.amountWei)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
