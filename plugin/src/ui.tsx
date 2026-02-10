import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { FigmaNodeData, AssetExport, PluginMessage } from './types';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface AppState {
  connectionStatus: ConnectionStatus;
  serverUrl: string;
  currentNode: FigmaNodeData | null;
  assets: AssetExport[];
  lastSyncTime: string | null;
  error: string | null;
}

interface NodeTreeItemProps {
  node: FigmaNodeData;
  depth: number;
  activeNodeId: string | null;
  expandedNodes: Set<string>;
  showAnnotatedOnly: boolean;
  onSelectNode: (node: FigmaNodeData) => void;
  onToggleExpand: (nodeId: string) => void;
}

const MAX_ANNOTATION_LENGTH = 2000;
const AUTOSAVE_DELAY = 500;

function hasAnnotationInSubtree(node: FigmaNodeData): boolean {
  if (node.annotation) return true;
  if (node.children) {
    return node.children.some(hasAnnotationInSubtree);
  }
  return false;
}

function countAnnotations(node: FigmaNodeData): number {
  let count = node.annotation ? 1 : 0;
  if (node.children) {
    count += node.children.reduce((sum, child) => sum + countAnnotations(child), 0);
  }
  return count;
}

const NodeTreeItem: React.FC<NodeTreeItemProps> = ({
  node,
  depth,
  activeNodeId,
  expandedNodes,
  showAnnotatedOnly,
  onSelectNode,
  onToggleExpand,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isActive = activeNodeId === node.id;
  const hasAnnotation = !!node.annotation;

  if (showAnnotatedOnly && !hasAnnotationInSubtree(node)) {
    return null;
  }

  const visibleChildren = showAnnotatedOnly
    ? node.children?.filter(hasAnnotationInSubtree)
    : node.children;

  return (
    <div>
      <div
        style={{
          ...styles.treeItem,
          paddingLeft: 8 + depth * 16,
          backgroundColor: isActive ? '#e0e7ff' : 'transparent',
        }}
        onClick={() => onSelectNode(node)}
      >
        {hasChildren && (
          <span
            style={styles.expandIcon}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span style={styles.expandIconPlaceholder} />}
        <span style={styles.treeNodeName}>{node.name}</span>
        <span style={styles.treeNodeType}>{node.type}</span>
        {hasAnnotation && <span style={styles.annotationBadge}>📝</span>}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {visibleChildren?.map((child) => (
            <NodeTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              expandedNodes={expandedNodes}
              showAnnotatedOnly={showAnnotatedOnly}
              onSelectNode={onSelectNode}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showAnnotatedOnly, setShowAnnotatedOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autosaveTimerRef = useRef<number | null>(null);

  const findNodeById = useCallback(
    (nodeId: string, root: FigmaNodeData | null): FigmaNodeData | null => {
      if (!root) return null;
      if (root.id === nodeId) return root;
      if (root.children) {
        for (const child of root.children) {
          const found = findNodeById(nodeId, child);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  const activeNode = activeNodeId ? findNodeById(activeNodeId, state.currentNode) : null;
  const currentAnnotation = activeNode
    ? drafts[activeNode.id] ?? activeNode.annotation ?? ''
    : '';
  const isDirty = activeNode
    ? drafts[activeNode.id] !== undefined && drafts[activeNode.id] !== (activeNode.annotation ?? '')
    : false;

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

          if (msg.data) {
            setExpandedNodes(new Set([msg.data.id]));
            const prevActiveStillExists = activeNodeId
              ? findNodeById(activeNodeId, msg.data) !== null
              : false;
            if (!prevActiveStillExists) {
              setActiveNodeId(msg.data.id);
            }
          } else {
            setActiveNodeId(null);
          }

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

        case 'annotation-updated':
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[msg.nodeId];
            return next;
          });
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 1500);
          break;

        case 'error':
          setState((prev) => ({ ...prev, error: msg.message }));
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ws, activeNodeId, findNodeById]);

  const connect = useCallback(() => {
    if (ws) {
      ws.close();
    }

    setState((prev) => ({ ...prev, connectionStatus: 'connecting', error: null }));

    const socket = new WebSocket(state.serverUrl);

    socket.onopen = () => {
      setState((prev) => ({ ...prev, connectionStatus: 'connected' }));
    };

    socket.onclose = () => {
      setState((prev) => ({ ...prev, connectionStatus: 'disconnected' }));
    };

    socket.onerror = () => {
      setState((prev) => ({
        ...prev,
        connectionStatus: 'error',
        error: '连接失败，请确保 MCP Server 正在运行',
      }));
    };

    setWs(socket);
  }, [state.serverUrl, ws]);

  const disconnect = useCallback(() => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  }, [ws]);

  const handleSelectNode = useCallback((node: FigmaNodeData) => {
    setActiveNodeId(node.id);
  }, []);

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const saveAnnotation = useCallback(
    (nodeId: string, text: string) => {
      setSaveStatus('saving');
      parent.postMessage(
        { pluginMessage: { type: 'set-annotation', nodeId, text } },
        '*'
      );
    },
    []
  );

  const handleAnnotationChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!activeNode) return;
      const text = e.target.value.slice(0, MAX_ANNOTATION_LENGTH);
      setDrafts((prev) => ({ ...prev, [activeNode.id]: text }));

      if (autosaveTimerRef.current !== null) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        saveAnnotation(activeNode.id, text);
        autosaveTimerRef.current = null;
      }, AUTOSAVE_DELAY) as unknown as number;
    },
    [activeNode, saveAnnotation]
  );

  const refreshSelection = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: 'request-selection' } }, '*');
  }, []);

  const annotationCount = state.currentNode ? countAnnotations(state.currentNode) : 0;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Figma to Code</h2>

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
          {state.lastSyncTime && <span style={styles.syncTime}> · 同步于 {state.lastSyncTime}</span>}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <label style={styles.label}>
            节点树 {annotationCount > 0 && <span style={styles.countBadge}>{annotationCount} 个标注</span>}
          </label>
          <div style={styles.headerActions}>
            <label style={styles.filterLabel}>
              <input
                type="checkbox"
                checked={showAnnotatedOnly}
                onChange={(e) => setShowAnnotatedOnly(e.target.checked)}
                style={styles.checkbox}
              />
              仅标注
            </label>
            <button onClick={refreshSelection} style={styles.buttonSmall}>
              刷新
            </button>
          </div>
        </div>

        {state.currentNode ? (
          <div style={styles.treeContainer}>
            <NodeTreeItem
              node={state.currentNode}
              depth={0}
              activeNodeId={activeNodeId}
              expandedNodes={expandedNodes}
              showAnnotatedOnly={showAnnotatedOnly}
              onSelectNode={handleSelectNode}
              onToggleExpand={handleToggleExpand}
            />
          </div>
        ) : (
          <div style={styles.placeholder}>请在 Figma 中选中一个图层</div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <label style={styles.label}>
            AI 标注
            {activeNode && (
              <span style={styles.activeNodeName}> - {activeNode.name}</span>
            )}
          </label>
          <div style={styles.saveStatusContainer}>
            {saveStatus === 'saving' && <span style={styles.savingText}>保存中...</span>}
            {saveStatus === 'saved' && <span style={styles.savedText}>✓ 已保存</span>}
            {isDirty && saveStatus === 'idle' && <span style={styles.dirtyText}>未保存</span>}
          </div>
        </div>

        {activeNode ? (
          <div>
            <textarea
              value={currentAnnotation}
              onChange={handleAnnotationChange}
              style={styles.textarea}
              placeholder="输入给 AI 的处理说明，如：这个列表需要支持下拉刷新和分页加载..."
              rows={4}
            />
            <div style={styles.charCount}>
              {currentAnnotation.length} / {MAX_ANNOTATION_LENGTH}
            </div>
          </div>
        ) : (
          <div style={styles.placeholder}>请在上方节点树中选择要标注的节点</div>
        )}
      </div>

      {state.error && <div style={styles.error}>{state.error}</div>}

      <div style={styles.help}>
        <p>1. 连接 MCP Server 后，选中的节点自动同步</p>
        <p>2. 在节点树中选择节点，添加标注说明给 AI</p>
        <p>3. 标注自动保存，无需手动操作</p>
      </div>
    </div>
  );
};

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

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    color: '#1f2937',
    height: '100%',
    boxSizing: 'border-box',
    overflow: 'auto',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
    paddingBottom: 10,
    borderBottom: '1px solid #e5e7eb',
  },
  section: {
    marginTop: 12,
    paddingBottom: 12,
    borderBottom: '1px solid #e5e7eb',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 12,
    marginBottom: 6,
    boxSizing: 'border-box',
  },
  buttonRow: {
    display: 'flex',
    gap: 6,
  },
  button: {
    flex: 1,
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  buttonDanger: {
    background: '#ef4444',
    color: '#ffffff',
    border: 'none',
  },
  buttonSmall: {
    padding: '3px 6px',
    fontSize: 11,
    border: '1px solid #d1d5db',
    borderRadius: 3,
    background: '#ffffff',
    cursor: 'pointer',
  },
  status: {
    marginTop: 6,
    fontSize: 11,
    color: '#6b7280',
  },
  syncTime: {
    color: '#9ca3af',
  },
  treeContainer: {
    maxHeight: 160,
    overflowY: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    background: '#fafafa',
  },
  treeItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 12,
    gap: 4,
    borderBottom: '1px solid #f3f4f6',
  },
  expandIcon: {
    width: 12,
    fontSize: 8,
    color: '#9ca3af',
    cursor: 'pointer',
    flexShrink: 0,
  },
  expandIconPlaceholder: {
    width: 12,
    flexShrink: 0,
  },
  treeNodeName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  treeNodeType: {
    fontSize: 10,
    color: '#9ca3af',
    background: '#f3f4f6',
    padding: '1px 4px',
    borderRadius: 2,
    flexShrink: 0,
  },
  annotationBadge: {
    fontSize: 10,
    flexShrink: 0,
  },
  countBadge: {
    fontSize: 10,
    color: '#0d9488',
    background: '#d1fae5',
    padding: '1px 4px',
    borderRadius: 8,
    fontWeight: 400,
  },
  filterLabel: {
    fontSize: 11,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    cursor: 'pointer',
  },
  checkbox: {
    margin: 0,
  },
  activeNodeName: {
    fontWeight: 400,
    color: '#2563eb',
  },
  textarea: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 12,
    resize: 'vertical',
    boxSizing: 'border-box',
    minHeight: 80,
    fontFamily: 'inherit',
  },
  charCount: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 2,
  },
  saveStatusContainer: {
    fontSize: 11,
  },
  savingText: {
    color: '#f59e0b',
  },
  savedText: {
    color: '#0d9488',
  },
  dirtyText: {
    color: '#9ca3af',
  },
  placeholder: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: 16,
    fontSize: 12,
  },
  error: {
    marginTop: 10,
    padding: 8,
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: 4,
    fontSize: 11,
  },
  help: {
    marginTop: 12,
    fontSize: 10,
    color: '#9ca3af',
    lineHeight: 1.5,
  },
};

export default App;
