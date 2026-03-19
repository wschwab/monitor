import { describe, it, expect } from 'vitest';
import { encodeMemo, decodeMemo, SERVICE_SLOTS, SLOT_TO_SERVICE, MAX_QUERY_INDEX } from './memo';

describe('memo encoding', () => {
  describe('encodeMemo', () => {
    it('should encode memo with valid data', () => {
      const memo = encodeMemo({
        taskId: 'task-123',
        serviceId: 'exa',
        queryIndex: 0
      });
      expect(memo).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('should produce exactly 64 hex chars (32 bytes)', () => {
      const memo = encodeMemo({
        taskId: '0x' + 'ab'.repeat(32),
        serviceId: 'exa',
        queryIndex: 42
      });
      expect(memo.length).toBe(66); // 0x + 64 chars
    });

    it('should encode known service IDs correctly', () => {
      const services = Object.keys(SERVICE_SLOTS);
      expect(services.length).toBeGreaterThan(0);

      for (const serviceId of ['exa', 'allium', 'llm', 'defi-stats']) {
        const memo = encodeMemo({
          taskId: 'test',
          serviceId,
          queryIndex: 0
        });
        expect(memo).toMatch(/^0x[0-9a-f]{64}$/);
      }
    });

    it('should throw for unknown service ID', () => {
      expect(() => encodeMemo({
        taskId: 'test',
        serviceId: 'unknown-service',
        queryIndex: 0
      })).toThrow(/Unknown serviceId/);
    });

    it('should throw for negative query index', () => {
      expect(() => encodeMemo({
        taskId: 'test',
        serviceId: 'exa',
        queryIndex: -1
      })).toThrow(/Invalid queryIndex/);
    });

    it('should handle hex task IDs', () => {
      const hexTaskId = '0x' + 'deadbeef'.repeat(8);
      const memo = encodeMemo({
        taskId: hexTaskId,
        serviceId: 'exa',
        queryIndex: 100
      });
      expect(memo).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe('decodeMemo', () => {
    it('should decode encoded memo', () => {
      const original = {
        taskId: '0x' + 'ab'.repeat(16),
        serviceId: 'exa',
        queryIndex: 42
      };
      const encoded = encodeMemo(original);
      const decoded = decodeMemo(encoded);

      expect(decoded.queryIndex).toBe(42);
      expect(decoded.serviceId).toBe('exa');
      // Task ID is truncated in encoding
    });

    it('should accept memo with or without 0x prefix', () => {
      const withPrefix = '0x' + '00'.repeat(32);
      const withoutPrefix = '00'.repeat(32);

      expect(() => decodeMemo(withPrefix)).not.toThrow();
      expect(() => decodeMemo(withoutPrefix)).not.toThrow();
    });

    it('should throw for invalid memo length', () => {
      expect(() => decodeMemo('0x1234')).toThrow(/Invalid memo length/);
      expect(() => decodeMemo('0x' + 'ab'.repeat(30))).toThrow(/Invalid memo length/);
    });

    it('should round-trip query index correctly', () => {
      for (const index of [0, 1, 100, 1000, 1000000]) {
        const memo = encodeMemo({ taskId: 'test', serviceId: 'exa', queryIndex: index });
        const decoded = decodeMemo(memo);
        expect(decoded.queryIndex).toBe(index);
      }
    });
  });

  describe('service slot mapping', () => {
    it('should have mapping for all service IDs', () => {
      const directMpp = ['exa', 'allium', 'perplexity', 'llm'];
      const wrapped = ['defi-stats', 'news'];
      const premium = ['cern-temporal', 'cia-declassified'];
      const enhancement = ['cover-image', 'audio-tts'];

      for (const serviceId of [...directMpp, ...wrapped, ...premium, ...enhancement]) {
        expect(SERVICE_SLOTS[serviceId]).toBeDefined();
        // Each slot should produce 16 hex chars (8 bytes) when encoded
        const encoded = Buffer.from(SERVICE_SLOTS[serviceId]).toString('hex');
        expect(encoded.length).toBe(16);
      }
    });

    it('should have inverse mapping', () => {
      for (const [serviceId, slot] of Object.entries(SERVICE_SLOTS)) {
        expect(SLOT_TO_SERVICE[slot]).toBe(serviceId);
      }
    });
  });

  describe('MAX_QUERY_INDEX', () => {
    it('should be max uint64', () => {
      expect(MAX_QUERY_INDEX).toBe(BigInt('0xFFFFFFFFFFFFFFFF'));
      expect(MAX_QUERY_INDEX > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle large query indices', () => {
      const largeIndex = 1000000000; // 1 billion
      const memo = encodeMemo({
        taskId: 'test',
        serviceId: 'exa',
        queryIndex: largeIndex
      });
      const decoded = decodeMemo(memo);
      expect(decoded.queryIndex).toBe(largeIndex);
    });

    it('should truncate long hex task IDs', () => {
      const longTaskId = '0x' + 'ab'.repeat(50); // 100 chars
      const memo = encodeMemo({
        taskId: longTaskId,
        serviceId: 'exa',
        queryIndex: 0
      });
      // Should still be 64 chars
      expect(memo.length).toBe(66);
    });

    it('should pad short string task IDs', () => {
      const shortTaskId = 'a';
      const memo = encodeMemo({
        taskId: shortTaskId,
        serviceId: 'exa',
        queryIndex: 0
      });
      expect(memo.length).toBe(66);
    });
  });
});