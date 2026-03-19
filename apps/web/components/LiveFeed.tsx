'use client';

/**
 * LiveFeed Component
 *
 * Displays the real-time activity stream for a running task.
 * Entries are sorted chronologically. Shows task status and stop button.
 */

import { ActivityEntry } from './ActivityEntry';

// =============================================================================
// Types (exported so tests can import them)
// =============================================================================

export interface FeedEntry {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  amountWei?: bigint;
  serviceId?: string;
}

export type TaskStatus =
  | 'CREATED' | 'FUNDING' | 'RUNNING' | 'COMPILING'
  | 'ENHANCING' | 'COMPLETE' | 'FAILED' | 'STOPPED';

export interface LiveFeedProps {
  entries: FeedEntry[];
  taskStatus: TaskStatus;
  onStop?: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

const ACTIVE_STATUSES: TaskStatus[] = ['CREATED', 'FUNDING', 'RUNNING', 'COMPILING', 'ENHANCING'];

const STATUS_LABELS: Record<TaskStatus, string> = {
  CREATED: 'Created — waiting for funding',
  FUNDING: 'Funding — waiting for deposit',
  RUNNING: 'Running — agent is working',
  COMPILING: 'Compiling — synthesizing report',
  ENHANCING: 'Enhancing — adding extras',
  COMPLETE: 'Complete',
  FAILED: 'Failed',
  STOPPED: 'Stopped by user',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  CREATED: '#94a3b8',
  FUNDING: '#f59e0b',
  RUNNING: '#60a5fa',
  COMPILING: '#a78bfa',
  ENHANCING: '#34d399',
  COMPLETE: '#4ade80',
  FAILED: '#f87171',
  STOPPED: '#94a3b8',
};

// =============================================================================
// Component
// =============================================================================

export function LiveFeed({ entries, taskStatus, onStop }: LiveFeedProps) {
  const isActive = ACTIVE_STATUSES.includes(taskStatus);
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const statusColor = STATUS_COLORS[taskStatus];
  const statusLabel = STATUS_LABELS[taskStatus];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#0f172a', borderRadius: '8px', border: `1px solid ${statusColor}40` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: isActive ? `0 0 6px ${statusColor}` : 'none' }} />
          <span style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
        </div>
        {isActive && onStop && (
          <button
            aria-label="Stop task"
            onClick={onStop}
            style={{ padding: '0.375rem 0.875rem', borderRadius: '6px', border: '1px solid #f87171', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Stop
          </button>
        )}
      </div>

      {/* Feed entries */}
      <div style={{ background: '#0a0a0a', borderRadius: '8px', border: '1px solid #1e293b', padding: '0 1rem' }}>
        {sorted.length === 0 ? (
          <p style={{ color: '#475569', padding: '1.5rem 0', textAlign: 'center' }}>
            {taskStatus === 'STOPPED' ? 'The run was cancelled before any activity.' : taskStatus === 'FAILED' ? 'An error occurred — check backend logs.' : 'Waiting for agent activity...'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sorted.map(entry => (
              <ActivityEntry key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
