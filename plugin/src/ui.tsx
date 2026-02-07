import React, { useState, useEffect, useCallback } from 'react';
import type { FigmaNodeData, AssetExport, PluginMessage } from './types';

// WebSocket 连接状态
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface AppState {
  connectionStatus: ConnectionStatus;
  serverUrl: string;
  currentNode: FigmaNodeData | null;
  assets: AssetExport[];
  lastSyncTime: string | null;
  error: string | null;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    connectionStatus: 'disconnected',
    serverUrl: 'ws://localhost:3001',
    currentNode: null,
    assets: [],
    lastSyncTime: null,
    error: null,
  });

  const [ws, setWs] = useState<WebSocket | null>(null);

  // 接收来自 Figma Plugin Sandbox 的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg: PluginMessage = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'selection-changed':
          setState((prev) => ({
            ...prev,
            currentNode: msg.data,
            assets: msg.assets,
            error: null,
          }));

          // 如果已连接，自动发送到服务器
          if (ws?.readyState === WebSocket.OPEN && msg.data) {
            ws.send(
              JSON.stringify({
                type: 'figma-selection',
                data: msg.data,
                assets: msg.assets,
                timestamp: new Date().toISOString(),
              })
            );
            setState((prev) => ({
              ...prev,
              lastSyncTime: new Date().toLocaleTimeString(),
            }));
          }
          break;

        case 'error':
          setState((prev) => ({ ...prev, error: msg.message }));
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ws]);

  // 连接到 MCP Server
  const connect = useCallback(() => {
    if (ws) {
      ws.close();
    }

    setState((prev) => ({ ...prev, connectionStatus: 'connecting', error: null }));

    const socket = new WebSocket(state.serverUrl);

    socket.onopen = () => {
      setState((prev) => ({ ...prev, connectionStatus: 'connected' }));
      console.log('Connected to MCP Server');
    };

    socket.onclose = () => {
      setState((prev) => ({ ...prev, connectionStatus: 'disconnected' }));
      console.log('Disconnected from MCP Server');
    };

    socket.onerror = (error) => {
      setState((prev) => ({
        ...prev,
        connectionStatus: 'error',
        error: '连接失败，请确保 MCP Server 正在运行',
      }));
      console.error('WebSocket error:', error);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('Message from server:', msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    setWs(socket);
  }, [state.serverUrl, ws]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  }, [ws]);

  // 手动发送当前选中
  const sendCurrentSelection = useCallback(() => {
    if (ws?.readyState === WebSocket.OPEN && state.currentNode) {
      ws.send(
        JSON.stringify({
          type: 'figma-selection',
          data: state.currentNode,
          assets: state.assets,
          timestamp: new Date().toISOString(),
        })
      );
      setState((prev) => ({
        ...prev,
        lastSyncTime: new Date().toLocaleTimeString(),
      }));
    }
  }, [ws, state.currentNode, state.assets]);

  // 请求刷新选中
  const refreshSelection = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: 'request-selection' } }, '*');
  }, []);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Figma to Code</h2>

      {/* 连接配置 */}
      <div style={styles.section}>
        <label style={styles.label}>MCP Server</label>
        <input
          type="text"
          value={state.serverUrl}
          onChange={(e) => setState((prev) => ({ ...prev, serverUrl: e.target.value }))}
          style={styles.input}
          placeholder="ws://localhost:3001"
        />
        <div style={styles.buttonRow}>
          {state.connectionStatus === 'connected' ? (
            <button onClick={disconnect} style={{ ...styles.button, ...styles.buttonDanger }}>
              断开连接
            </button>
          ) : (
            <button
              onClick={connect}
              style={styles.button}
              disabled={state.connectionStatus === 'connecting'}
            >
              {state.connectionStatus === 'connecting' ? '连接中...' : '连接服务器'}
            </button>
          )}
        </div>
        <div style={styles.status}>
          状态:{' '}
          <span style={{ color: getStatusColor(state.connectionStatus) }}>
            {getStatusText(state.connectionStatus)}
          </span>
        </div>
      </div>

      {/* 当前选中 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <label style={styles.label}>当前选中</label>
          <button onClick={refreshSelection} style={styles.buttonSmall}>
            刷新
          </button>
        </div>

        {state.currentNode ? (
          <div style={styles.nodeInfo}>
            <div style={styles.nodeName}>{state.currentNode.name}</div>
            <div style={styles.nodeType}>{state.currentNode.type}</div>
            <div style={styles.nodeMeta}>
              {Math.round(state.currentNode.width)} × {Math.round(state.currentNode.height)}
              {state.currentNode.children && ` · ${state.currentNode.children.length} 子节点`}
            </div>
            {state.assets.length > 0 && (
              <div style={styles.assetCount}>{state.assets.length} 个资源</div>
            )}
          </div>
        ) : (
          <div style={styles.placeholder}>请在 Figma 中选中一个图层</div>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={styles.section}>
        <button
          onClick={sendCurrentSelection}
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            opacity: state.connectionStatus === 'connected' && state.currentNode ? 1 : 0.5,
          }}
          disabled={state.connectionStatus !== 'connected' || !state.currentNode}
        >
          重新发送
        </button>
        {state.lastSyncTime && (
          <div style={styles.syncTime}>上次同步: {state.lastSyncTime}</div>
        )}
      </div>

      {/* 错误提示 */}
      {state.error && <div style={styles.error}>{state.error}</div>}

      {/* 使用说明 */}
      <div style={styles.help}>
        <p>1. 启动 MCP Server: <code>npm run start</code></p>
        <p>2. 点击"连接服务器"</p>
        <p>3. 选中 Figma 图层，自动同步到 MCP</p>
      </div>
    </div>
  );
};

// 状态颜色
function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '#0d9488';
    case 'connecting':
      return '#f59e0b';
    case 'error':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

// 状态文本
function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '已连接';
    case 'connecting':
      return '连接中...';
    case 'error':
      return '连接失败';
    default:
      return '未连接';
  }
}

// 样式
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    fontSize: 13,
    color: '#1f2937',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
    margin: 0,
    paddingBottom: 12,
    borderBottom: '1px solid #e5e7eb',
  },
  section: {
    marginTop: 16,
    paddingBottom: 16,
    borderBottom: '1px solid #e5e7eb',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#6b7280',
    marginBottom: 6,
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 8,
    boxSizing: 'border-box',
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
  },
  button: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  buttonPrimary: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
  },
  buttonDanger: {
    background: '#ef4444',
    color: '#ffffff',
    border: 'none',
  },
  buttonSmall: {
    padding: '4px 8px',
    fontSize: 11,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    background: '#ffffff',
    cursor: 'pointer',
  },
  status: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  nodeInfo: {
    background: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  nodeName: {
    fontWeight: 600,
    marginBottom: 4,
  },
  nodeType: {
    fontSize: 11,
    color: '#6b7280',
    background: '#e5e7eb',
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 4,
    marginBottom: 6,
  },
  nodeMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  assetCount: {
    marginTop: 6,
    fontSize: 11,
    color: '#0d9488',
  },
  placeholder: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
  },
  syncTime: {
    marginTop: 8,
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  error: {
    marginTop: 12,
    padding: 10,
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: 6,
    fontSize: 12,
  },
  help: {
    marginTop: 16,
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 1.6,
  },
};

export default App;
