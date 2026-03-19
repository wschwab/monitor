/**
 * WebSocket Server
 *
 * Broadcasts real-time task updates to connected clients.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { FeedEntry } from '@monitor/shared';

// =============================================================================
// Types
// =============================================================================

export interface WSMessage {
  type: 'task_update' | 'feed_entry' | 'status_change' | 'complete' | 'error';
  taskId: string;
  timestamp: number;
  payload: unknown;
}

export interface WSServerOptions {
  port?: number;
  path?: string;
}

// =============================================================================
// WebSocket Server
// =============================================================================

export class WSServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocket>> = new Map();

  constructor(options: WSServerOptions = {}) {
    this.wss = new WebSocketServer({
      port: options.port || 3002,
      path: options.path || '/ws',
    });

    this.setupConnectionHandling();
  }

  /**
   * Setup WebSocket connection handling.
   */
  private setupConnectionHandling(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      // Extract task ID from URL query params
      const url = new URL(req.url || '/', 'http://localhost');
      const taskId = url.searchParams.get('taskId');

      if (taskId) {
        this.subscribe(taskId, ws);
      }

      ws.on('close', () => {
        if (taskId) {
          this.unsubscribe(taskId, ws);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
        message: taskId ? `Subscribed to task ${taskId}` : 'Connected (no task subscription)',
      }));
    });
  }

  /**
   * Subscribe a client to a task's updates.
   */
  subscribe(taskId: string, ws: WebSocket): void {
    if (!this.clients.has(taskId)) {
      this.clients.set(taskId, new Set());
    }
    this.clients.get(taskId)!.add(ws);
  }

  /**
   * Unsubscribe a client from a task's updates.
   */
  unsubscribe(taskId: string, ws: WebSocket): void {
    const taskClients = this.clients.get(taskId);
    if (taskClients) {
      taskClients.delete(ws);
      if (taskClients.size === 0) {
        this.clients.delete(taskId);
      }
    }
  }

  /**
   * Broadcast a message to all subscribers of a task.
   */
  broadcast(taskId: string, message: WSMessage): void {
    const taskClients = this.clients.get(taskId);
    if (!taskClients || taskClients.size === 0) {
      return;
    }

    const messageStr = JSON.stringify(message);

    taskClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  /**
   * Broadcast a feed entry to task subscribers.
   */
  broadcastFeedEntry(taskId: string, entry: FeedEntry): void {
    this.broadcast(taskId, {
      type: 'feed_entry',
      taskId,
      timestamp: Date.now(),
      payload: entry,
    });
  }

  /**
   * Broadcast a status change.
   */
  broadcastStatusChange(taskId: string, status: string): void {
    this.broadcast(taskId, {
      type: 'status_change',
      taskId,
      timestamp: Date.now(),
      payload: { status },
    });
  }

  /**
   * Broadcast task completion.
   */
  broadcastComplete(taskId: string, result: unknown): void {
    this.broadcast(taskId, {
      type: 'complete',
      taskId,
      timestamp: Date.now(),
      payload: result,
    });
  }

  /**
   * Broadcast an error.
   */
  broadcastError(taskId: string, error: string): void {
    this.broadcast(taskId, {
      type: 'error',
      taskId,
      timestamp: Date.now(),
      payload: { error },
    });
  }

  /**
   * Get number of connected clients for a task.
   */
  getSubscriberCount(taskId: string): number {
    return this.clients.get(taskId)?.size || 0;
  }

  /**
   * Get total number of connected clients.
   */
  getTotalConnections(): number {
    let total = 0;
    this.clients.forEach((clients) => {
      total += clients.size;
    });
    return total;
  }

  /**
   * Close the WebSocket server.
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        resolve();
      });
    });
  }
}