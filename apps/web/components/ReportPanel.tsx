'use client';

interface ReportPanelProps {
  prompt: string;
  report: string;
}

export function ReportPanel({ prompt, report }: ReportPanelProps) {
  return (
    <section
      style={{
        background: '#020617',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        padding: '1.25rem',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Research Report</h2>
        <p style={{ margin: '0.5rem 0 0', color: '#94a3b8' }}>{prompt}</p>
      </div>
      {report ? (
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
            lineHeight: 1.7,
            color: '#e2e8f0',
          }}
        >
          {report}
        </pre>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Report content has not been attached to this task yet.</p>
      )}
    </section>
  );
}
