/**
 * WebSocket Client
 *
 * Connects to the Monitor backend WebSocket server for real-time task updates.
 * Automatically reconnects on disconnect. Exposes a clean event emitter API.
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3002';

export type WSEventType = 'feed_entry' | 'status_change' | 'complete' | 'error' | 'connected';

export interface WSMessage {
  type: WSEventType;
  taskId: string;
  timestamp: number;
  payload: unknown;
}

export type WSHandler = (message: WSMessage) => void;

export interface WSClientOptions {
  taskId: string;
  onMessage: WSHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
  /** Override WebSocket URL for testing */
  wsUrl?: string;
}

export class WSClient {
  private ws: WebSocket | null = null;
  private taskId: string;
  private onMessage: WSHandler;
  private onConnect?: () => void;
  private onDisconnect?: () => void;
  private wsUrl: string;
  private closed = false;

  constructor(options: WSClientOptions) {
    this.taskId = options.taskId;
    this.onMessage = options.onMessage;
    this.onConnect = options.onConnect;
    this.onDisconnect = options.onDisconnect;
    this.wsUrl = options.wsUrl ?? WS_URL;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const url = `${this.wsUrl}/ws?taskId=${this.taskId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        this.onMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.onDisconnect?.();
    };

    this.ws.onerror = () => {
      // errors surface through onclose
    };
  }

  disconnect(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Create and immediately connect a WSClient.
 * Returns a cleanup function.
 */
export function connectToTask(options: WSClientOptions): () => void {
  const client = new WSClient(options);
  client.connect();
  return () => client.disconnect();
}
