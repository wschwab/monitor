/**
 * Task Live Feed Page
 *
 * Shows the real-time activity stream for a running task.
 * Rehydrates state on load, then subscribes to WebSocket updates.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { LiveFeed, FeedEntry, TaskStatus } from '../../../components/LiveFeed';
import { rehydrateTask, runTask, stopTask } from '../../../lib/api';
import { connectToTask, WSMessage } from '../../../lib/ws';

// =============================================================================
// Page
// =============================================================================

export default function TaskPage() {
  const params = useParams();
  const taskId = params.taskId as string;

  const [status, setStatus] = useState<TaskStatus>('CREATED');
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingRun, setStartingRun] = useState(false);
  const disconnectRef = useRef<(() => void) | null>(null);
  const devFundingBypass =
    process.env.NEXT_PUBLIC_DEV_FUNDING_BYPASS !== 'false' &&
    process.env.NODE_ENV !== 'production';

  // Rehydrate on mount
  useEffect(() => {
    if (!taskId) return;

    rehydrateTask(taskId)
      .then(({ task, feedEntries }) => {
        setStatus(task.status as TaskStatus);
        // Convert string amountWei back to bigint for display
        setEntries(feedEntries.map(e => ({
          ...e,
          amountWei: e.amountWei ? BigInt(e.amountWei) : undefined,
        })));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message ?? 'Failed to load task');
        setLoading(false);
      });
  }, [taskId]);

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (!taskId || loading) return;

    const disconnect = connectToTask({
      taskId,
      onMessage: (msg: WSMessage) => {
        if (msg.type === 'feed_entry') {
          const payload = msg.payload as FeedEntry & { amountWei?: string | bigint };
          const entry: FeedEntry = {
            ...payload,
            amountWei:
              payload.amountWei !== undefined ? BigInt(payload.amountWei) : undefined,
          };
          setEntries(prev => [...prev, entry]);
        }
        if (msg.type === 'status_change') {
          const { status: newStatus } = msg.payload as { status: TaskStatus };
          setStatus(newStatus);
        }
        if (msg.type === 'complete') {
          setStatus('COMPLETE');
          disconnectRef.current?.();
          disconnectRef.current = null;
        }
        if (msg.type === 'error') {
          setStatus('FAILED');
          disconnectRef.current?.();
          disconnectRef.current = null;
        }
      },
    });

    disconnectRef.current = disconnect;
    return () => disconnect();
  }, [taskId, loading]);

  async function handleStop() {
    disconnectRef.current?.();
    await stopTask(taskId);
    setStatus('STOPPED');
  }

  async function handleFundingStart() {
    setStartingRun(true);
    setError(null);

    try {
      await runTask(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start task');
    } finally {
      setStartingRun(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: '#080808', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#475569' }}>Loading task...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ minHeight: '100vh', background: '#080808', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#f87171' }}>Error: {error}</p>
      </main>
    );
  }

  const isComplete = status === 'COMPLETE';
  const showFundingGate = status === 'CREATED' || status === 'FUNDING';

  return (
    <main style={{ minHeight: '100vh', background: '#080808', color: '#e2e8f0' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <a href="/" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← New Task
            </a>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0 0' }}>
              🔬 Live Feed
            </h1>
          </div>
          <code style={{ fontSize: '0.75rem', color: '#334155', background: '#0f172a', padding: '0.25rem 0.75rem', borderRadius: '4px' }}>
            {taskId}
          </code>
        </div>

        {/* Live Feed */}
        {showFundingGate && (
          <section
            style={{
              marginBottom: '1rem',
              padding: '1rem 1.125rem',
              borderRadius: '10px',
              border: '1px solid #334155',
              background: '#020617',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '0.35rem' }}>
                  {devFundingBypass ? 'Dev funding bypass ready' : 'Tempo wallet funding required'}
                </div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem', maxWidth: '40rem' }}>
                  {devFundingBypass
                    ? 'This local flow uses a dev-mode bypass instead of a passkey wallet. Starting the run will simulate the funding step and continue through the live feed.'
                    : 'Approve funding in Tempo wallet before the agent can begin executing this task.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleFundingStart}
                disabled={startingRun}
                style={{
                  padding: '0.75rem 1.1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0ea5e9',
                  color: '#f8fafc',
                  fontWeight: 700,
                  cursor: startingRun ? 'progress' : 'pointer',
                }}
              >
                {startingRun
                  ? 'Starting run...'
                  : devFundingBypass
                    ? 'Use Dev Funding Bypass'
                    : 'Fund with Tempo Wallet'}
              </button>
            </div>
          </section>
        )}

        <LiveFeed
          entries={entries}
          taskStatus={status}
          onStop={handleStop}
        />

        {/* Results link when complete */}
        {isComplete && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <a
              href={`/task/${taskId}/results`}
              style={{ display: 'inline-block', padding: '0.875rem 2rem', background: '#6366f1', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}
            >
              View Report & Audit →
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
