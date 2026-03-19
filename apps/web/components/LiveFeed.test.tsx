/**
 * LiveFeed Component Tests
 *
 * TDD: Written FIRST (RED), implementation follows (GREEN).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LiveFeed } from './LiveFeed';
import type { FeedEntry } from './LiveFeed';

// =============================================================================
// Fixtures
// =============================================================================

const STATUS_ENTRY: FeedEntry = {
  id: 'e1',
  type: 'status',
  message: 'Task is now RUNNING',
  timestamp: 1700000000000,
};

const QUERY_ENTRY: FeedEntry = {
  id: 'e2',
  type: 'query',
  message: 'Querying Exa for CERN dossier...',
  timestamp: 1700000001000,
};

const SPEND_ENTRY: FeedEntry = {
  id: 'e3',
  type: 'spend',
  message: 'Spent 0.01 ETH on exa',
  timestamp: 1700000002000,
  amountWei: BigInt('10000000000000000'),
  serviceId: 'exa',
};

const COMPLETE_ENTRY: FeedEntry = {
  id: 'e4',
  type: 'complete',
  message: 'Report complete',
  timestamp: 1700000010000,
};

// =============================================================================
// Tests
// =============================================================================

describe('LiveFeed', () => {
  describe('rendering', () => {
    it('renders empty state when no entries', () => {
      render(<LiveFeed entries={[]} taskStatus="RUNNING" />);
      expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    });

    it('renders each feed entry', () => {
      render(<LiveFeed entries={[STATUS_ENTRY, QUERY_ENTRY]} taskStatus="RUNNING" />);
      expect(screen.getByText(/Task is now RUNNING/i)).toBeInTheDocument();
      expect(screen.getByText(/Querying Exa/i)).toBeInTheDocument();
    });

    it('renders spend entry with amount', () => {
      render(<LiveFeed entries={[SPEND_ENTRY]} taskStatus="RUNNING" />);
      expect(screen.getByText(/Spent 0.01 ETH on exa/i)).toBeInTheDocument();
    });

    it('renders complete entry with success indicator', () => {
      render(<LiveFeed entries={[COMPLETE_ENTRY]} taskStatus="COMPLETE" />);
      expect(screen.getByText(/Report complete/i)).toBeInTheDocument();
    });

    it('shows STOPPED status when task is stopped', () => {
      render(<LiveFeed entries={[]} taskStatus="STOPPED" />);
      expect(screen.getByText(/stopped/i)).toBeInTheDocument();
    });

    it('shows FAILED status when task failed', () => {
      render(<LiveFeed entries={[]} taskStatus="FAILED" />);
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });

  describe('entry ordering', () => {
    it('renders entries in chronological order', () => {
      render(
        <LiveFeed
          entries={[QUERY_ENTRY, STATUS_ENTRY]} // out of order
          taskStatus="RUNNING"
        />
      );
      const items = screen.getAllByRole('listitem');
      expect(items[0]).toHaveTextContent(/Task is now RUNNING/i);
      expect(items[1]).toHaveTextContent(/Querying Exa/i);
    });
  });

  describe('live updates', () => {
    it('renders new entries when entries prop updates', () => {
      const { rerender } = render(<LiveFeed entries={[STATUS_ENTRY]} taskStatus="RUNNING" />);
      expect(screen.queryByText(/Querying Exa/i)).not.toBeInTheDocument();

      rerender(<LiveFeed entries={[STATUS_ENTRY, QUERY_ENTRY]} taskStatus="RUNNING" />);
      expect(screen.getByText(/Querying Exa/i)).toBeInTheDocument();
    });
  });

  describe('stop button', () => {
    it('renders stop button when task is active and onStop provided', () => {
      const onStop = vi.fn();
      render(<LiveFeed entries={[]} taskStatus="RUNNING" onStop={onStop} />);
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });

    it('does not render stop button when task is complete', () => {
      const onStop = vi.fn();
      render(<LiveFeed entries={[]} taskStatus="COMPLETE" onStop={onStop} />);
      expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    });

    it('calls onStop when stop button clicked', async () => {
      const onStop = vi.fn();
      const { getByRole } = render(
        <LiveFeed entries={[]} taskStatus="RUNNING" onStop={onStop} />
      );
      getByRole('button', { name: /stop/i }).click();
      expect(onStop).toHaveBeenCalledOnce();
    });
  });
});
