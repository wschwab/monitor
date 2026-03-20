import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskPage from './page';

const rehydrateTask = vi.fn();
const runTask = vi.fn();
const stopTask = vi.fn();
const connectToTask = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ taskId: 'task-123' }),
}));

vi.mock('../../../lib/api', () => ({
  rehydrateTask: (...args: unknown[]) => rehydrateTask(...args),
  runTask: (...args: unknown[]) => runTask(...args),
  stopTask: (...args: unknown[]) => stopTask(...args),
}));

vi.mock('../../../lib/ws', () => ({
  connectToTask: (...args: unknown[]) => connectToTask(...args),
}));

describe('TaskPage', () => {
  beforeEach(() => {
    rehydrateTask.mockReset();
    runTask.mockReset();
    stopTask.mockReset();
    connectToTask.mockReset();
    connectToTask.mockImplementation(() => () => undefined);
  });

  it('shows the funding gate for created tasks and starts the run from the bypass button', async () => {
    const user = userEvent.setup();

    rehydrateTask.mockResolvedValue({
      task: {
        id: 'task-123',
        prompt: 'Find the classified CERN dossier on Hououin Kyouma',
        status: 'CREATED',
        budgetWei: '1000000000000000000',
        spentWei: '0',
        createdAt: 1700000000000,
        deadline: 1700003600000,
        sources: ['exa', 'cern-temporal'],
        owner: '0x0000000000000000000000000000000000000000',
      },
      feedEntries: [],
    });
    runTask.mockResolvedValue({ result: { success: true } });

    render(<TaskPage />);

    expect(await screen.findByText(/Dev funding bypass ready/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Use Dev Funding Bypass/i }));

    await waitFor(() => {
      expect(runTask).toHaveBeenCalledWith('task-123');
    });
  });

  it('renders feed entries pushed over websocket with stringified bigint amounts', async () => {
    rehydrateTask.mockResolvedValue({
      task: {
        id: 'task-123',
        prompt: 'Find the classified CERN dossier on Hououin Kyouma',
        status: 'RUNNING',
        budgetWei: '1000000000000000000',
        spentWei: '0',
        createdAt: 1700000000000,
        deadline: 1700003600000,
        sources: ['exa', 'cern-temporal'],
        owner: '0x0000000000000000000000000000000000000000',
      },
      feedEntries: [],
    });
    connectToTask.mockImplementation(({ onMessage }: { onMessage: (message: unknown) => void }) => {
      onMessage({
        type: 'feed_entry',
        taskId: 'task-123',
        timestamp: 1700000003000,
        payload: {
          id: 'feed-1',
          type: 'spend',
          message: 'Spent 0.0100 ETH on exa',
          timestamp: 1700000003000,
          amountWei: '10000000000000000',
          serviceId: 'exa',
        },
      });

      return () => undefined;
    });

    render(<TaskPage />);

    expect(await screen.findByText(/Spent 0.0100 ETH on exa/i)).toBeInTheDocument();
    expect(screen.getByText(/\(0.0100 ETH\)/i)).toBeInTheDocument();
  });
});
