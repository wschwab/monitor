/**
 * Memo Encoding/Decoding
 *
 * Encodes task context into 32-byte on-chain memo field for Treasury spend.
 *
 * ## Format Specification
 *
 * The memo field is exactly 32 bytes (64 hex chars), laid out as:
 *
 * | Bytes | Field       | Description                    |
 * |-------|-------------|--------------------------------|
 * | 0-15  | taskId      | First 16 bytes of task ID hash |
 * | 16-23 | serviceId   | Service identifier (8 bytes)   |
 * | 24-31 | queryIndex  | Query index (8 bytes, big-end) |
 *
 * ## Handling Long IDs
 *
 * - Task IDs are truncated to 16 bytes (first 32 hex chars)
 * - Service IDs are mapped to 8-byte slot identifiers
 * - Query indexes are stored as big-endian uint64
 *
 * ## Decoding Limitation
 *
 * Decoded task IDs are truncated hashes. Full task ID resolution requires
 * backend lookup using taskId + queryIndex combination.
 */

import { MEMO_TASK_ID_BYTES, MEMO_SERVICE_ID_BYTES, MEMO_QUERY_INDEX_BYTES } from './constants';

/**
 * Memo data structure for encoding.
 */
export interface MemoData {
  /** Task identifier (will be truncated if > 32 hex chars) */
  taskId: string;
  /** Service identifier (will be mapped to slot) */
  serviceId: string;
  /** Query index within task execution */
  queryIndex: number;
}

/**
 * Maximum query index that fits in 8 bytes (2^64 - 1).
 */
export const MAX_QUERY_INDEX = BigInt('0xFFFFFFFFFFFFFFFF');

/**
 * Service ID to 8-byte slot mapping.
 *
 * This mapping ensures consistent encoding of service IDs
 * across all components. New services must be added here.
 *
 * Each slot must be exactly 8 ASCII characters.
 */
export const SERVICE_SLOTS: Record<string, string> = {
  // Direct MPP providers (slots 0x01-0x0F)
  'exa': 'exa00000',
  'allium': 'allium00',
  'perplexity': 'perplex0',
  'llm': 'llm00000',

  // Wrapped providers (slots 0x10-0x1F)
  'defi-stats': 'defist00',
  'news': 'news0000',

  // Premium providers (slots 0x20-0x2F)
  'cern-temporal': 'cerntm00',
  'cia-declassified': 'ciadc000',

  // Enhancement services (slots 0x30-0x3F)
  'cover-image': 'coverimg',
  'audio-tts': 'audio000',
};

/**
 * Inverse mapping from slot bytes to service ID.
 */
export const SLOT_TO_SERVICE: Record<string, string> = Object.fromEntries(
  Object.entries(SERVICE_SLOTS).map(([k, v]) => [v, k])
);

/**
 * Encodes memo data into a 32-byte hex string.
 *
 * @param data - The memo data to encode
 * @returns 64-character hex string (with 0x prefix)
 * @throws Error if queryIndex exceeds maximum
 *
 * @example
 * ```typescript
 * const memo = encodeMemo({
 *   taskId: 'task-abc123',
 *   serviceId: 'exa',
 *   queryIndex: 0
 * });
 * // Returns: '0x...' (64 hex chars)
 * ```
 */
export function encodeMemo(data: MemoData): string {
  if (data.queryIndex < 0) {
    throw new Error(`Invalid queryIndex: ${data.queryIndex} (must be >= 0)`);
  }
  if (BigInt(data.queryIndex) > MAX_QUERY_INDEX) {
    throw new Error(`queryIndex overflow: ${data.queryIndex} exceeds maximum ${MAX_QUERY_INDEX}`);
  }

  const taskIdBytes = encodeTaskId(data.taskId);
  const serviceIdBytes = encodeServiceId(data.serviceId);
  const queryIndexBytes = encodeQueryIndex(data.queryIndex);

  return '0x' + taskIdBytes + serviceIdBytes + queryIndexBytes;
}

/**
 * Decodes a 32-byte hex memo into its components.
 *
 * @param memo - 64-character hex string (with or without 0x prefix)
 * @returns Decoded memo data
 * @throws Error if memo length is invalid
 *
 * @example
 * ```typescript
 * const data = decodeMemo('0x...');
 * console.log(data.serviceId); // 'exa'
 * console.log(data.queryIndex); // 0
 * ```
 */
export function decodeMemo(memo: string): MemoData {
  const hex = memo.startsWith('0x') ? memo.slice(2) : memo;

  if (hex.length !== 64) {
    throw new Error(`Invalid memo length: expected 64 hex chars, got ${hex.length}`);
  }

  const taskIdHex = hex.slice(0, MEMO_TASK_ID_BYTES * 2);
  const serviceIdHex = hex.slice(MEMO_TASK_ID_BYTES * 2, (MEMO_TASK_ID_BYTES + MEMO_SERVICE_ID_BYTES) * 2);
  const queryIndexHex = hex.slice((MEMO_TASK_ID_BYTES + MEMO_SERVICE_ID_BYTES) * 2);

  return {
    taskId: '0x' + taskIdHex,
    serviceId: decodeServiceId(serviceIdHex),
    queryIndex: parseInt(queryIndexHex, 16),
  };
}

/**
 * Encodes a task ID to 16 bytes (32 hex chars).
 *
 * For 0x-prefixed hex IDs, takes first 32 chars after prefix.
 * For string IDs, converts to hex and truncates.
 */
function encodeTaskId(taskId: string): string {
  if (taskId.startsWith('0x')) {
    // Hex ID: truncate or pad to 32 chars
    const hex = taskId.slice(2);
    return padOrTruncate(hex, MEMO_TASK_ID_BYTES * 2);
  }
  // String ID: convert to hex, then truncate/pad
  const hex = Buffer.from(taskId).toString('hex');
  return padOrTruncate(hex, MEMO_TASK_ID_BYTES * 2);
}

/**
 * Encodes a service ID to 8 bytes using slot mapping.
 *
 * @throws Error if service ID is not in SERVICE_SLOTS
 */
function encodeServiceId(serviceId: string): string {
  const slot = SERVICE_SLOTS[serviceId];
  if (!slot) {
    throw new Error(`Unknown serviceId: ${serviceId}. Must be one of: ${Object.keys(SERVICE_SLOTS).join(', ')}`);
  }
  return Buffer.from(slot).toString('hex');
}

/**
 * Decodes an 8-byte service slot back to service ID.
 */
function decodeServiceId(hex: string): string {
  const bytes = Buffer.from(hex, 'hex').toString();
  const serviceId = SLOT_TO_SERVICE[bytes];
  return serviceId || `unknown:${hex}`;
}

/**
 * Encodes a query index to 8 bytes (big-endian uint64).
 */
function encodeQueryIndex(index: number): string {
  const buf = Buffer.alloc(8);
  // Write as big-endian uint64 (JS numbers are safe up to 2^53)
  // For true uint64, use BigInt
  const high = Math.floor(index / 0x100000000);
  const low = index % 0x100000000;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);
  return buf.toString('hex');
}

/**
 * Pads or truncates a hex string to exact length.
 */
function padOrTruncate(hex: string, length: number): string {
  if (hex.length >= length) {
    return hex.slice(0, length);
  }
  return hex.padStart(length, '0');
}