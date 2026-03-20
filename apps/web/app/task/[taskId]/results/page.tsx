'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuditPanel } from '../../../../components/AuditPanel';
import { BudgetChart } from '../../../../components/BudgetChart';
import { ReportPanel } from '../../../../components/ReportPanel';
import { rehydrateTask, type RehydrateResult } from '../../../../lib/api';
import { buildResultsViewModel, formatEth } from '../../../../lib/results';

export default function ResultsPage() {
  const params = useParams();
  const taskId = params.taskId as string;

  const [data, setData] = useState<RehydrateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    rehydrateTask(taskId)
      .then(setData)
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load task results');
      });
  }, [taskId]);

  if (error) {
    return (
      <main style={{ minHeight: '100vh', background: '#080808', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#f87171' }}>Error: {error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ minHeight: '100vh', background: '#080808', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#475569' }}>Loading results...</p>
      </main>
    );
  }

  const model = buildResultsViewModel(data);
  const spentWei = BigInt(model.task.spentWei);

  return (
    <main style={{ minHeight: '100vh', background: '#080808', color: '#e2e8f0' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div>
            <a href={`/task/${taskId}`} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← Back to live feed
            </a>
            <h1 style={{ fontSize: '1.85rem', margin: '0.5rem 0 0' }}>Results</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Task status
            </div>
            <div style={{ fontWeight: 700 }}>{model.task.status}</div>
            <div style={{ marginTop: '0.35rem', color: '#94a3b8', fontSize: '0.875rem' }}>
              Spent {formatEth(spentWei)}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <BudgetChart
            budgetWei={BigInt(model.task.budgetWei)}
            spentWei={spentWei}
            refundWei={model.refundWei}
            consistency={model.consistency}
          />
          <ReportPanel prompt={model.task.prompt} report={model.report} />
          <AuditPanel entries={model.auditEntries} totals={model.totals} />
        </div>
      </div>
    </main>
  );
}
