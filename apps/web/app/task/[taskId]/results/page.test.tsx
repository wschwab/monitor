import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResultsPage from './page';

const rehydrateTask = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ taskId: 'task-123' }),
}));

vi.mock('../../../../lib/api', () => ({
  rehydrateTask: (...args: unknown[]) => rehydrateTask(...args),
}));

describe('ResultsPage', () => {
  beforeEach(() => {
    rehydrateTask.mockReset();
  });

  it('renders report, audit rows, and exact refund for a completed task', async () => {
    rehydrateTask.mockResolvedValue({
      task: {
        id: 'task-123',
        prompt: 'Investigate anomaly budgets',
        status: 'COMPLETE',
        budgetWei: '2000000000000000000',
        spentWei: '1300000000000000000',
        createdAt: 1700000000000,
        deadline: 1700003600000,
        sources: ['exa', 'allium', 'cia-declassified'],
        owner: '0x0000000000000000000000000000000000000000',
      },
      feedEntries: [
        {
          id: 'spend-1',
          type: 'spend',
          message: 'Premium dossier lookup',
          timestamp: 1700000001000,
          amountWei: '600000000000000000',
          serviceId: 'cia-declassified',
          payload: {
            path: 'TREASURY',
            memo: '0x00000000000000007461736b2d31323363696164633030300000000000000000',
            queryIndex: 0,
          },
        },
        {
          id: 'spend-2',
          type: 'spend',
          message: 'Direct market data query',
          timestamp: 1700000002000,
          amountWei: '500000000000000000',
          serviceId: 'allium',
          payload: { path: 'DIRECT_MPP', memo: '', queryIndex: 1 },
        },
        {
          id: 'spend-3',
          type: 'spend',
          message: 'LLM synthesis cost',
          timestamp: 1700000003000,
          amountWei: '200000000000000000',
          serviceId: 'llm-synthesize',
          payload: { path: 'LLM', memo: '', queryIndex: 2 },
        },
        {
          id: 'complete-1',
          type: 'complete',
          message: 'Report complete',
          timestamp: 1700000004000,
          payload: {
            report:
              '# Executive Summary\n\nThe budget held. Costs reconciled cleanly.',
            coverImage: {
              imageUrl: 'https://demo.monitor/hououin-kyouma.png',
              title: 'Hououin Kyouma Temporal Incident Brief',
              alt: 'Collage of a lab console, CRT monitor, and worldline graph',
            },
          },
        },
      ],
    });

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /results/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Executive Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Spend totals reconciled/i)).toBeInTheDocument();
    expect(screen.getByText(/Refund due/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0.7000 USDC/i)).toHaveLength(2);
    expect(screen.getByText(/Premium dossier lookup/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct market data query/i)).toBeInTheDocument();
    expect(screen.getByText(/LLM synthesis cost/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /worldline graph/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Memo verified: cia-declassified · query #0 · task 0x00000000...313233/i)
    ).toBeInTheDocument();
  });

  it('surfaces an audit mismatch warning when totals diverge', async () => {
    rehydrateTask.mockResolvedValue({
      task: {
        id: 'task-123',
        prompt: 'Investigate anomaly budgets',
        status: 'COMPLETE',
        budgetWei: '2000000000000000000',
        spentWei: '1300000000000000000',
        createdAt: 1700000000000,
        deadline: 1700003600000,
        sources: ['cia-declassified'],
        owner: '0x0000000000000000000000000000000000000000',
      },
      feedEntries: [
        {
          id: 'spend-1',
          type: 'spend',
          message: 'Premium dossier lookup',
          timestamp: 1700000001000,
          amountWei: '600000000000000000',
          serviceId: 'cia-declassified',
          payload: { path: 'TREASURY', memo: '0xabc', queryIndex: 0 },
        },
        {
          id: 'complete-1',
          type: 'complete',
          message: 'Report complete',
          timestamp: 1700000004000,
          payload: { report: 'Report body' },
        },
      ],
    });

    render(<ResultsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Audit total differs from task spend by 0.7000 USDC/i)
      ).toBeInTheDocument();
    });
  });
});
