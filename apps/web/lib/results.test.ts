import { describe, expect, it } from 'vitest';
import { buildResultsViewModel } from './results';

const TASK = {
  id: 'task-123',
  prompt: 'Investigate anomaly budgets',
  status: 'COMPLETE',
  budgetWei: '2000000000000000000',
  spentWei: '1300000000000000000',
  createdAt: 1700000000000,
  deadline: 1700003600000,
  sources: ['exa', 'allium', 'cia-declassified'],
  owner: '0x0000000000000000000000000000000000000000',
};

describe('buildResultsViewModel', () => {
  it('builds a reconciled report and audit summary from mixed spend paths', () => {
    const model = buildResultsViewModel({
      task: TASK,
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
          },
        },
      ],
    });

    expect(model.report).toContain('Executive Summary');
    expect(model.auditEntries).toHaveLength(3);
    expect(model.totals.totalWei).toBe(BigInt('1300000000000000000'));
    expect(model.totals.byPath.TREASURY).toBe(BigInt('600000000000000000'));
    expect(model.totals.byPath.DIRECT_MPP).toBe(BigInt('500000000000000000'));
    expect(model.totals.byPath.LLM).toBe(BigInt('200000000000000000'));
    expect(model.refundWei).toBe(BigInt('700000000000000000'));
    expect(model.consistency.kind).toBe('reconciled');
    expect(model.auditEntries[0]?.memoSummary).toBe(
      'Memo verified: cia-declassified · query #0 · task 0x00000000...313233'
    );
  });

  it('flags a mismatch when audit rows do not add up to the reported spend', () => {
    const model = buildResultsViewModel({
      task: TASK,
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

    expect(model.consistency.kind).toBe('mismatch');
    expect(model.consistency.deltaWei).toBe(BigInt('700000000000000000'));
  });

  it('keeps legacy memos readable when they cannot be decoded', () => {
    const model = buildResultsViewModel({
      task: TASK,
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
      ],
    });

    expect(model.auditEntries[0]?.memoSummary).toBe('Memo: 0xabc');
  });

  it('extracts a cover image from the completion payload when one is attached', () => {
    const model = buildResultsViewModel({
      task: TASK,
      feedEntries: [
        {
          id: 'complete-1',
          type: 'complete',
          message: 'Report complete',
          timestamp: 1700000004000,
          payload: {
            report: 'Report body',
            coverImage: {
              imageUrl: 'https://demo.monitor/hououin-kyouma.png',
              title: 'Hououin Kyouma Temporal Incident Brief',
              alt: 'Collage of a lab console, CRT monitor, and worldline graph',
            },
          },
        },
      ],
    });

    expect(model.coverImage).toEqual({
      imageUrl: 'https://demo.monitor/hououin-kyouma.png',
      title: 'Hououin Kyouma Temporal Incident Brief',
      alt: 'Collage of a lab console, CRT monitor, and worldline graph',
    });
  });
});
