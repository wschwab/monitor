'use client';

/**
 * TaskForm Component
 *
 * Form for creating a new research task. Collects prompt, budget,
 * deadline, and source provider selections.
 */

import { useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface TaskFormPayload {
  prompt: string;
  budgetEth: number;
  deadlineSeconds: number;
  sources: string[];
  enhancements: {
    coverImage: boolean;
    audioBriefing: boolean;
    uploadDelivery: boolean;
    emailDelivery: boolean;
  };
}

export interface TaskFormProps {
  onSubmit: (payload: TaskFormPayload) => Promise<void> | void;
  disabled?: boolean;
}

// =============================================================================
// Source Definitions
// =============================================================================

const SOURCES = [
  { id: 'exa', label: 'Exa Search', category: 'Direct', cost: '$0.01/query', defaultOn: true },
  { id: 'perplexity', label: 'Perplexity AI', category: 'Direct', cost: '$0.05/query', defaultOn: false },
  { id: 'allium', label: 'Allium Data', category: 'Direct', cost: '$0.02/query', defaultOn: false },
  { id: 'cern-temporal', label: 'CERN Temporal', category: 'Premium', cost: '$0.10/query', defaultOn: false },
  { id: 'cia-declassified', label: 'CIA Declassified', category: 'Premium', cost: '$0.10/query', defaultOn: false },
];

const DEFAULT_SOURCES = SOURCES.filter(s => s.defaultOn).map(s => s.id);

// =============================================================================
// Component
// =============================================================================

export function TaskForm({ onSubmit, disabled = false }: TaskFormProps) {
  const [prompt, setPrompt] = useState('');
  const [budgetEth, setBudgetEth] = useState(1);
  const [deadlineHours, setDeadlineHours] = useState(1);
  const [selectedSources, setSelectedSources] = useState<string[]>(DEFAULT_SOURCES);
  const [coverImage, setCoverImage] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValid = prompt.trim().length > 0 && budgetEth > 0 && selectedSources.length > 0;

  function toggleSource(id: string) {
    setSelectedSources(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    try {
      await onSubmit({
        prompt: prompt.trim(),
        budgetEth,
        deadlineSeconds: deadlineHours * 3600,
        sources: selectedSources,
        enhancements: {
          coverImage,
          audioBriefing: false,
          uploadDelivery: false,
          emailDelivery: false,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  const directSources = SOURCES.filter(s => s.category === 'Direct');
  const premiumSources = SOURCES.filter(s => s.category === 'Premium');

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Prompt */}
      <div>
        <label htmlFor="prompt" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
          Research Prompt
        </label>
        <textarea
          id="prompt"
          aria-label="Prompt"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. Find the classified CERN dossier on Hououin Kyouma and summarize his temporal interference incidents"
          rows={4}
          disabled={disabled || loading}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #333', background: '#111', color: '#fff', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {/* Budget + Deadline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label htmlFor="budget" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Budget (ETH)
          </label>
          <input
            id="budget"
            aria-label="Budget"
            type="number"
            min={0.01}
            step={0.01}
            value={budgetEth}
            onChange={e => setBudgetEth(parseFloat(e.target.value) || 0)}
            disabled={disabled || loading}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #333', background: '#111', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="deadline" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Deadline (hours)
          </label>
          <input
            id="deadline"
            aria-label="Deadline"
            type="number"
            min={1}
            max={24}
            value={deadlineHours}
            onChange={e => setDeadlineHours(parseInt(e.target.value) || 1)}
            disabled={disabled || loading}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #333', background: '#111', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Sources */}
      <div>
        <p style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Data Sources</p>

        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>Direct Providers</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {directSources.map(source => (
            <label key={source.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                aria-label={source.label}
                checked={selectedSources.includes(source.id)}
                onChange={() => toggleSource(source.id)}
                disabled={disabled || loading}
              />
              <span>{source.label}</span>
              <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 'auto' }}>{source.cost}</span>
            </label>
          ))}
        </div>

        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>Premium Sources (Treasury-backed)</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {premiumSources.map(source => (
            <label key={source.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                aria-label={source.label}
                checked={selectedSources.includes(source.id)}
                onChange={() => toggleSource(source.id)}
                disabled={disabled || loading}
              />
              <span>{source.label}</span>
              <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 'auto' }}>{source.cost}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Enhancements</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            aria-label="Cover image"
            checked={coverImage}
            onChange={() => setCoverImage((value) => !value)}
            disabled={disabled || loading}
          />
          <span>Cover image</span>
          <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 'auto' }}>$0.20/report</span>
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || disabled || loading}
        style={{
          padding: '0.875rem 2rem',
          borderRadius: '6px',
          border: 'none',
          background: isValid && !loading ? '#6366f1' : '#333',
          color: '#fff',
          fontWeight: 600,
          fontSize: '1rem',
          cursor: isValid && !loading ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s',
        }}
      >
        {loading ? 'Starting...' : 'Start Research'}
      </button>
    </form>
  );
}
