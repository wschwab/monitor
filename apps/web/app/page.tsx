/**
 * Home Page — Task Creation
 *
 * The entry point. Users describe their research goal,
 * set a budget, pick sources, and launch.
 */

'use client';

import { useRouter } from 'next/navigation';
import { TaskForm, TaskFormPayload } from '../components/TaskForm';
import { createTask } from '../lib/api';

export default function HomePage() {
  const router = useRouter();

  async function handleSubmit(payload: TaskFormPayload) {
    const { task } = await createTask(payload);
    router.push(`/task/${task.id}`);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#080808', color: '#e2e8f0' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '4rem 1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
            🔬 Monitor
          </h1>
          <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>
            Monitor your agent monitoring the situation.
          </p>
        </div>

        {/* Form Card */}
        <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', padding: '2rem' }}>
          <TaskForm onSubmit={handleSubmit} />
        </div>

        {/* Footer hint */}
        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: '#334155', fontSize: '0.85rem' }}>
          Budget is locked in a smart contract. Unused funds are refunded on completion.
        </p>
      </div>
    </main>
  );
}
