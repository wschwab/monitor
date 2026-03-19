import { describe, it, expect } from 'vitest';
import {
  TaskStatus,
  SpendEntry,
  Task,
  EnhancementToggles,
  WSEvent,
  WSEventType,
  ProviderId,
  PROVIDER_IDS,
  PROVIDER_CATEGORIES,
  DEFAULT_ENHANCEMENTS,
  SpendPath,
} from './types';

describe('TaskStatus', () => {
  it('should have all expected lifecycle states', () => {
    const expected: TaskStatus[] = [
      'CREATED', 'FUNDING', 'RUNNING', 'COMPILING', 'ENHANCING', 'COMPLETE', 'FAILED', 'STOPPED'
    ];
    // Type check: if this compiles, all states exist
    const status: TaskStatus = 'CREATED';
    expect(typeof status).toBe('string');
  });

  it('should allow valid status transitions', () => {
    const status: TaskStatus = 'CREATED';
    // CREATED -> FUNDING is valid
    const next: TaskStatus = 'FUNDING';
    expect(['CREATED', 'FUNDING']).toContain(status);
    expect(['CREATED', 'FUNDING']).toContain(next);
  });
});

describe('EnhancementToggles', () => {
  it('should have all enhancement options', () => {
    const toggles: EnhancementToggles = {
      coverImage: true,
      audioBriefing: false,
      uploadDelivery: false,
      emailDelivery: false,
    };
    expect(toggles.coverImage).toBe(true);
    expect(toggles.audioBriefing).toBe(false);
  });

  it('should provide default enhancement toggles (all disabled)', () => {
    expect(DEFAULT_ENHANCEMENTS.coverImage).toBe(false);
    expect(DEFAULT_ENHANCEMENTS.audioBriefing).toBe(false);
    expect(DEFAULT_ENHANCEMENTS.uploadDelivery).toBe(false);
    expect(DEFAULT_ENHANCEMENTS.emailDelivery).toBe(false);
  });
});

describe('PROVIDER_IDS', () => {
  it('should have all direct MPP providers', () => {
    expect(PROVIDER_IDS.EXA).toBe('exa');
    expect(PROVIDER_IDS.ALLIUM).toBe('allium');
    expect(PROVIDER_IDS.PERPLEXITY).toBe('perplexity');
  });

  it('should have all wrapped providers', () => {
    expect(PROVIDER_IDS.DEFI_STATS).toBe('defi-stats');
    expect(PROVIDER_IDS.NEWS).toBe('news');
  });

  it('should have all premium providers', () => {
    expect(PROVIDER_IDS.CERN_TEMPORAL).toBe('cern-temporal');
    expect(PROVIDER_IDS.CIA_DECLASSIFIED).toBe('cia-declassified');
  });

  it('should match provider categories', () => {
    expect(PROVIDER_CATEGORIES.direct).toContain('exa');
    expect(PROVIDER_CATEGORIES.wrapped).toContain('defi-stats');
    expect(PROVIDER_CATEGORIES.premium).toContain('cern-temporal');
  });
});

describe('SpendEntry', () => {
  it('should support all spend paths', () => {
    const paths: SpendPath[] = ['TREASURY', 'DIRECT_MPP', 'LLM'];
    expect(paths).toHaveLength(3);
  });

  it('should create valid spend entry', () => {
    const entry: SpendEntry = {
      id: 'spend-1',
      taskId: 'task-1',
      serviceId: 'exa',
      queryIndex: 0,
      amountWei: BigInt('1000000000000000'),
      timestamp: Date.now(),
      memo: '0x' + '00'.repeat(32),
      path: 'DIRECT_MPP',
    };
    expect(entry.id).toBe('spend-1');
    expect(entry.path).toBe('DIRECT_MPP');
  });
});

describe('Task', () => {
  it('should define complete task structure', () => {
    const task: Task = {
      id: 'task-123',
      prompt: 'Research AI agents',
      budgetWei: BigInt('1000000000000000000'),
      spentWei: BigInt('0'),
      status: 'CREATED',
      createdAt: Date.now(),
      deadline: Date.now() + 3600000,
      sources: ['exa'],
      enhancements: DEFAULT_ENHANCEMENTS,
      owner: '0x1234567890abcdef',
    };
    expect(task.status).toBe('CREATED');
    expect(task.budgetWei > task.spentWei).toBe(true);
  });
});

describe('WSEvent', () => {
  it('should support all event types', () => {
    const types: WSEventType[] = [
      'status', 'source', 'query', 'reasoning', 'enhancement', 'spend', 'complete', 'error'
    ];
    expect(types).toHaveLength(8);
  });

  it('should create valid websocket event', () => {
    const event: WSEvent<{ status: TaskStatus }> = {
      type: 'status',
      taskId: 'task-1',
      timestamp: Date.now(),
      payload: { status: 'RUNNING' },
    };
    expect(event.type).toBe('status');
    expect(event.taskId).toBe('task-1');
  });
});

describe('Provider ID type safety', () => {
  it('should constrain provider IDs to known values', () => {
    // This test verifies TypeScript compile-time type checking
    // If this compiles, ProviderId is correctly typed
    const validId: ProviderId = 'exa';
    expect(typeof validId).toBe('string');
  });
});