// ============================================================
// WebSocket Server - 接收 Figma 插件数据
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import { dataStore } from './data-store.js';
import type { FigmaSelectionMessage } from './types.js';

const WS_PORT = 3001;

let wss: WebSocketServer | null = null;
let connectedClients: Set<WebSocket> = new Set();

export function startWebSocketServer(): void {
  if (wss) {
    console.log('[WebSocket] Server already running');
    return;
  }

  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('listening', () => {
    console.log(`[WebSocket] Server listening on ws://localhost:${WS_PORT}`);
  });

  wss.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`[WebSocket] Port ${WS_PORT} already in use — another instance is handling WebSocket connections`);
      wss = null;
      return;
    }
    console.error('[WebSocket] Server error:', error);
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] Client connected');
    connectedClients.add(ws);

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to Figma MCP Server',
      timestamp: new Date().toISOString(),
    }));

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(message, ws);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      connectedClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      connectedClients.delete(ws);
    });
  });
}

function handleMessage(message: unknown, ws: WebSocket): void {
  if (!isValidMessage(message)) {
    console.warn('[WebSocket] Invalid message format');
    return;
  }

  switch (message.type) {
    case 'figma-selection':
      dataStore.setSelection(message as FigmaSelectionMessage);
      // 确认收到
      ws.send(JSON.stringify({
        type: 'ack',
        originalType: 'figma-selection',
        nodeId: (message as FigmaSelectionMessage).data.id,
        timestamp: new Date().toISOString(),
      }));
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    default:
      console.log('[WebSocket] Unknown message type:', message.type);
  }
}

function isValidMessage(message: unknown): message is { type: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof (message as { type: unknown }).type === 'string'
  );
}

export function stopWebSocketServer(): void {
  if (wss) {
    for (const client of connectedClients) {
      client.close();
    }
    connectedClients.clear();
    wss.close();
    wss = null;
    console.log('[WebSocket] Server stopped');
  }
}

export function getConnectionCount(): number {
  return connectedClients.size;
}

export function broadcastMessage(message: unknown): void {
  const data = JSON.stringify(message);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
