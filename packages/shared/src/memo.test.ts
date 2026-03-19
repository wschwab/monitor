import { describe, it, expect } from 'vitest';
import { encodeMemo, decodeMemo } from './memo';

describe('memo encoding', () => {
  it('should encode and decode memos', () => {
    const data = { taskId: 'abc123', serviceId: 'exa', queryIndex: 0 };
    const encoded = encodeMemo(data);
    const decoded = decodeMemo(encoded);
    expect(decoded.queryIndex).toBe(0);
  });
});