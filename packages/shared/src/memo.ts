/**
 * Memo Encoding/Decoding
 *
 * Encodes task context into 32-byte on-chain memo field.
 * Layout: [taskId: 16 bytes][serviceId: 8 bytes][queryIndex: 8 bytes]
 */

import { MEMO_TASK_ID_BYTES, MEMO_SERVICE_ID_BYTES, MEMO_QUERY_INDEX_BYTES } from './constants';

export interface MemoData {
  taskId: string;
  serviceId: string;
  queryIndex: number;
}

/**
 * Encodes memo data into a 32-byte hex string.
 * Task ID and Service ID are truncated or hashed to fit.
 */
export function encodeMemo(data: MemoData): string {
  const taskIdBytes = truncateOrHash(data.taskId, MEMO_TASK_ID_BYTES);
  const serviceIdBytes = truncateOrHash(data.serviceId, MEMO_SERVICE_ID_BYTES);
  const queryIndexBytes = padStart(data.queryIndex.toString(16), MEMO_QUERY_INDEX_BYTES * 2);

  return '0x' + taskIdBytes + serviceIdBytes + queryIndexBytes;
}

/**
 * Decodes a 32-byte hex memo into its components.
 * Note: Task ID and Service ID may be truncated hashes.
 */
export function decodeMemo(memo: string): MemoData {
  const hex = memo.startsWith('0x') ? memo.slice(2) : memo;

  if (hex.length !==64) {
    throw new Error(`Invalid memo length: expected 64 hex chars, got ${hex.length}`);
  }

  const taskIdHex = hex.slice(0, MEMO_TASK_ID_BYTES * 2);
  const serviceIdHex = hex.slice(MEMO_TASK_ID_BYTES * 2, (MEMO_TASK_ID_BYTES + MEMO_SERVICE_ID_BYTES) * 2);
  const queryIndexHex = hex.slice((MEMO_TASK_ID_BYTES + MEMO_SERVICE_ID_BYTES) * 2);

  return {
    taskId: '0x' + taskIdHex,
    serviceId: '0x' + serviceIdHex,
    queryIndex: parseInt(queryIndexHex, 16),
  };
}

/**
 * Truncates a string or hashes it to fit the specified byte length.
 */
function truncateOrHash(input: string, byteLength: number): string {
  // For now, simple truncation/padding
  // TODO: Add proper hashing for longer IDs
  const hex = input.startsWith('0x') ? input.slice(2) : Buffer.from(input).toString('hex');
  if (hex.length >= byteLength * 2) {
    return hex.slice(0, byteLength * 2);
  }
  return padStart(hex, byteLength * 2);
}

/**
 * Pads a hex string to the specified length.
 */
function padStart(hex: string, length: number): string {
  return hex.padStart(length, '0').slice(0, length);
}