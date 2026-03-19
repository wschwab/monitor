'use client';

/**
 * ActivityEntry Component
 *
 * Renders a single feed entry in the live activity stream.
 */

import type { FeedEntry } from './LiveFeed';

const TYPE_ICONS: Record<string, string> = {
  status: '📋',
  query: '🔍',
  reasoning: '🧠',
  spend: '💸',
  enhancement: '✨',
  complete: '✅',
  error: '❌',
  source: '📡',
};

const TYPE_COLORS: Record<string, string> = {
  status: '#94a3b8',
  query: '#60a5fa',
  reasoning: '#a78bfa',
  spend: '#f59e0b',
  enhancement: '#34d399',
  complete: '#4ade80',
  error: '#f87171',
  source: '#38bdf8',
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatWei(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return `${eth.toFixed(4)} ETH`;
}

interface ActivityEntryProps {
  entry: FeedEntry;
}

export function ActivityEntry({ entry }: ActivityEntryProps) {
  const icon = TYPE_ICONS[entry.type] ?? '•';
  const color = TYPE_COLORS[entry.type] ?? '#94a3b8';

  return (
    <li
      style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '0.625rem 0',
        borderBottom: '1px solid #1e293b',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: '1.5', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color, wordBreak: 'break-word' }}>{entry.message}</span>
        {entry.amountWei !== undefined && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#f59e0b' }}>
            ({formatWei(entry.amountWei)})
          </span>
        )}
      </div>
      <span style={{ fontSize: '0.75rem', color: '#475569', flexShrink: 0, paddingTop: '0.125rem' }}>
        {formatTime(entry.timestamp)}
      </span>
    </li>
  );
}
