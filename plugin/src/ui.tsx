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
    isMinimized: boolean;
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
        count += node.children.reduce(
            (sum, child) => sum + countAnnotations(child),
            0,
        );
    }
    return count;
}

function updateNodeAnnotation(
    node: FigmaNodeData,
    nodeId: string,
    annotation: string,
): FigmaNodeData {
    if (node.id === nodeId) {
        return { ...node, annotation: annotation || undefined };
    }
    if (node.children) {
        return {
            ...node,
            children: node.children.map((child) =>
                updateNodeAnnotation(child, nodeId, annotation),
            ),
        };
    }
    return node;
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

    const treeItemStyle: React.CSSProperties = {
        ...styles.treeItem,
        paddingLeft: 10 + depth * 14,
        ...(isActive
            ? {
                  background: 'rgba(13, 148, 136, 0.12)',
                  boxShadow: 'inset 0 0 0 1.5px #0d9488',
              }
            : {}),
    };

    return (
        <div>
            <div style={treeItemStyle} onClick={() => onSelectNode(node)}>
                {hasChildren && (
                    <span
                        style={styles.expandIcon}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(node.id);
                        }}
                    >
                        {isExpanded ? '▾' : '▸'}
                    </span>
                )}
                {!hasChildren && <span style={styles.expandIconPlaceholder} />}
                <span
                    style={{
                        ...styles.treeNodeName,
                        ...(isActive ? { color: '#0d9488' } : {}),
                    }}
                >
                    {node.name}
                </span>
                <span style={styles.treeNodeType}>{node.type}</span>
                {hasAnnotation && <span style={styles.annotationBadge}>✎</span>}
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
        isMinimized: false,
    });

    const [ws, setWs] = useState<WebSocket | null>(null);
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [showAnnotatedOnly, setShowAnnotatedOnly] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
        'idle',
    );
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
        [],
    );

    const activeNode = activeNodeId
        ? findNodeById(activeNodeId, state.currentNode)
        : null;
    const currentAnnotation = activeNode
        ? drafts[activeNode.id] ?? activeNode.annotation ?? ''
        : '';
    const isDirty = activeNode
        ? drafts[activeNode.id] !== undefined &&
          drafts[activeNode.id] !== (activeNode.annotation ?? '')
        : false;

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const msg: PluginMessage = event.data.pluginMessage;
            if (!msg) return;

            switch (msg.type) {
                case 'selection-changed':
                    if (autosaveTimerRef.current !== null) {
                        clearTimeout(autosaveTimerRef.current);
                        autosaveTimerRef.current = null;
                    }
                    setDrafts({});
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

                    break;

                case 'annotation-updated':
                    setState((prev) => ({
                        ...prev,
                        currentNode: prev.currentNode
                            ? updateNodeAnnotation(
                                  prev.currentNode,
                                  msg.nodeId,
                                  msg.annotation,
                              )
                            : null,
                    }));
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

                case 'window-state-changed':
                    setState((prev) => ({
                        ...prev,
                        isMinimized: msg.minimized,
                    }));
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

        setState((prev) => ({
            ...prev,
            connectionStatus: 'connecting',
            error: null,
        }));

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
        parent.postMessage(
            { pluginMessage: { type: 'select-node', nodeId: node.id } },
            '*',
        );
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

    const saveAnnotation = useCallback((nodeId: string, text: string) => {
        setSaveStatus('saving');
        parent.postMessage(
            { pluginMessage: { type: 'set-annotation', nodeId, text } },
            '*',
        );
    }, []);

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
        [activeNode, saveAnnotation],
    );

    const refreshSelection = useCallback(() => {
        parent.postMessage(
            { pluginMessage: { type: 'request-selection' } },
            '*',
        );
    }, []);

    const syncToMCP = useCallback(() => {
        if (ws?.readyState === WebSocket.OPEN && state.currentNode) {
            ws.send(
                JSON.stringify({
                    type: 'figma-selection',
                    data: state.currentNode,
                    assets: state.assets,
                    timestamp: new Date().toISOString(),
                }),
            );
            setState((prev) => ({
                ...prev,
                lastSyncTime: new Date().toLocaleTimeString(),
            }));
        }
    }, [ws, state.currentNode, state.assets]);

    const minimizeWindow = useCallback(() => {
        parent.postMessage({ pluginMessage: { type: 'minimize-window' } }, '*');
    }, []);

    const restoreWindow = useCallback(() => {
        parent.postMessage({ pluginMessage: { type: 'restore-window' } }, '*');
    }, []);

    const annotationCount = state.currentNode
        ? countAnnotations(state.currentNode)
        : 0;

    if (state.isMinimized) {
        return (
            <div style={styles.minimizedBall} onClick={restoreWindow}>
                <span style={styles.ballIcon}>F</span>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>
                    <span style={styles.titleIcon}>F</span>
                    Figma to Code
                </h2>
                <button
                    onClick={minimizeWindow}
                    style={styles.minimizeButton}
                    title="最小化"
                >
                    −
                </button>
            </div>

            <div style={styles.section}>
                <label style={{ ...styles.label, marginBottom: 10 }}>
                    MCP Server
                </label>
                <input
                    type="text"
                    value={state.serverUrl}
                    onChange={(e) =>
                        setState((prev) => ({
                            ...prev,
                            serverUrl: e.target.value,
                        }))
                    }
                    style={styles.input}
                    placeholder="ws://localhost:3001"
                />
                <div style={styles.buttonRow}>
                    {state.connectionStatus === 'connected' ? (
                        <button
                            onClick={disconnect}
                            style={{ ...styles.button, ...styles.buttonDanger }}
                        >
                            断开连接
                        </button>
                    ) : (
                        <button
                            onClick={connect}
                            style={styles.button}
                            disabled={state.connectionStatus === 'connecting'}
                        >
                            {state.connectionStatus === 'connecting'
                                ? '连接中...'
                                : '连接服务器'}
                        </button>
                    )}
                </div>
                <div style={styles.status}>
                    <span
                        style={{
                            ...styles.statusDot,
                            background: getStatusColor(state.connectionStatus),
                            boxShadow:
                                state.connectionStatus === 'connected'
                                    ? `0 0 6px ${getStatusColor(state.connectionStatus)}`
                                    : 'none',
                        }}
                    />
                    <span
                        style={{
                            color: getStatusColor(state.connectionStatus),
                            fontWeight: 500,
                        }}
                    >
                        {getStatusText(state.connectionStatus)}
                    </span>
                    {state.lastSyncTime && (
                        <span style={styles.syncTime}>
                            {' '}
                            · 同步于 {state.lastSyncTime}
                        </span>
                    )}
                    {state.connectionStatus === 'connected' && (
                        <button
                            onClick={syncToMCP}
                            style={{
                                ...styles.buttonSmall,
                                marginLeft: 'auto',
                            }}
                            disabled={!state.currentNode}
                        >
                            同步 MCP
                        </button>
                    )}
                </div>
            </div>

            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <label style={styles.label}>
                        节点树{' '}
                        {annotationCount > 0 && (
                            <span style={styles.countBadge}>
                                {annotationCount} 个标注
                            </span>
                        )}
                    </label>
                    <div style={styles.headerActions}>
                        <label style={styles.filterLabel}>
                            <input
                                type="checkbox"
                                checked={showAnnotatedOnly}
                                onChange={(e) =>
                                    setShowAnnotatedOnly(e.target.checked)
                                }
                                style={styles.checkbox}
                            />
                            仅标注
                        </label>
                        <button
                            onClick={refreshSelection}
                            style={styles.buttonSmall}
                        >
                            导入选中节点
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
                    <div style={styles.placeholder}>
                        请在 Figma 中选中一个图层
                    </div>
                )}
            </div>

            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <label style={styles.label}>
                        AI 标注
                        {activeNode && (
                            <span style={styles.activeNodeName}>
                                {' '}
                                - {activeNode.name}
                            </span>
                        )}
                    </label>
                    <div style={styles.saveStatusContainer}>
                        {saveStatus === 'saving' && (
                            <span style={styles.savingText}>保存中...</span>
                        )}
                        {saveStatus === 'saved' && (
                            <span style={styles.savedText}>✓ 已保存</span>
                        )}
                        {isDirty && saveStatus === 'idle' && (
                            <span style={styles.dirtyText}>未保存</span>
                        )}
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
                    <div style={styles.placeholder}>
                        请在上方节点树中选择要标注的节点
                    </div>
                )}
            </div>

            {state.error && <div style={styles.error}>{state.error}</div>}

            <div style={styles.help}>
                <p>1. 点击"导入选中节点"获取当前 Figma 选中内容</p>
                <p>2. 在节点树中选择节点，添加标注说明给 AI</p>
                <p>3. 标注自动保存，点击"同步 MCP"推送给 AI</p>
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

const colors = {
    primary: '#0d9488',
    primaryLight: '#14b8a6',
    primaryDark: '#0f766e',
    primaryGlow: 'rgba(13, 148, 136, 0.15)',
    primarySoft: 'rgba(13, 148, 136, 0.08)',

    bgPrimary: '#fafaf9',
    bgSecondary: '#f5f5f4',
    bgTertiary: '#ffffff',
    bgElevated: 'rgba(255, 255, 255, 0.9)',
    bgGlass: 'rgba(255, 255, 255, 0.85)',

    textPrimary: '#1c1917',
    textSecondary: '#57534e',
    textMuted: '#a8a29e',
    textInverse: '#ffffff',

    border: '#e7e5e4',
    borderLight: '#f5f5f4',
    borderFocus: '#0d9488',

    success: '#059669',
    successBg: '#d1fae5',
    warning: '#d97706',
    warningBg: '#fef3c7',
    error: '#dc2626',
    errorBg: '#fee2e2',

    shadowSoft:
        '0 1px 3px rgba(28, 25, 23, 0.04), 0 1px 2px rgba(28, 25, 23, 0.06)',
    shadowMedium:
        '0 4px 6px -1px rgba(28, 25, 23, 0.08), 0 2px 4px -2px rgba(28, 25, 23, 0.06)',
    shadowLarge:
        '0 10px 15px -3px rgba(28, 25, 23, 0.1), 0 4px 6px -4px rgba(28, 25, 23, 0.1)',
    shadowGlow: '0 0 20px rgba(13, 148, 136, 0.25)',
};

const styles: Record<string, React.CSSProperties> = {
    minimizedBall: {
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: `linear-gradient(145deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: `${colors.shadowLarge}, ${colors.shadowGlow}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        overflow: 'hidden',
    },
    ballIcon: {
        color: colors.textInverse,
        fontSize: 20,
        fontWeight: 700,
        fontFamily:
            '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        letterSpacing: '-0.5px',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
    },

    container: {
        padding: 16,
        fontFamily:
            '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 13,
        color: colors.textPrimary,
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'auto',
        background: `linear-gradient(180deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 100%)`,
        letterSpacing: '-0.01em',
    },

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 14,
        marginBottom: 2,
        borderBottom: `1px solid ${colors.border}`,
    },
    title: {
        fontSize: 15,
        fontWeight: 600,
        margin: 0,
        color: colors.textPrimary,
        letterSpacing: '-0.02em',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    titleIcon: {
        width: 20,
        height: 20,
        borderRadius: 6,
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        color: colors.textInverse,
        fontWeight: 700,
    },
    minimizeButton: {
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 8,
        background: colors.bgSecondary,
        cursor: 'pointer',
        fontSize: 18,
        fontWeight: 400,
        color: colors.textMuted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        transition: 'all 0.2s ease',
    },

    section: {
        marginTop: 16,
        padding: 14,
        background: colors.bgTertiary,
        borderRadius: 12,
        boxShadow: colors.shadowSoft,
        border: `1px solid ${colors.borderLight}`,
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    label: {
        fontSize: 11,
        fontWeight: 600,
        color: colors.textSecondary,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    },

    input: {
        width: '100%',
        padding: '10px 12px',
        border: `1.5px solid ${colors.border}`,
        borderRadius: 8,
        fontSize: 13,
        marginBottom: 10,
        boxSizing: 'border-box',
        background: colors.bgPrimary,
        color: colors.textPrimary,
        transition: 'all 0.2s ease',
        outline: 'none',
    },

    buttonRow: {
        display: 'flex',
        gap: 8,
    },
    button: {
        flex: 1,
        padding: '10px 14px',
        border: 'none',
        borderRadius: 8,
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
        color: colors.textInverse,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        transition: 'all 0.2s ease',
        boxShadow: colors.shadowSoft,
    },
    buttonSecondary: {
        flex: 1,
        padding: '10px 14px',
        border: `1.5px solid ${colors.border}`,
        borderRadius: 8,
        background: colors.bgTertiary,
        color: colors.textSecondary,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        transition: 'all 0.2s ease',
    },
    buttonDanger: {
        background: `linear-gradient(135deg, ${colors.error} 0%, #b91c1c 100%)`,
        color: colors.textInverse,
        border: 'none',
        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
    },
    buttonSmall: {
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 500,
        border: 'none',
        borderRadius: 6,
        background: colors.primarySoft,
        color: colors.primary,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        letterSpacing: '-0.01em',
    },

    status: {
        marginTop: 12,
        fontSize: 12,
        color: colors.textSecondary,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        display: 'inline-block',
        marginRight: 6,
    },
    syncTime: {
        color: colors.textMuted,
        fontSize: 11,
    },

    treeContainer: {
        maxHeight: 180,
        overflowY: 'auto',
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        background: colors.bgPrimary,
        padding: 4,
    },
    treeItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 10px',
        cursor: 'pointer',
        fontSize: 12,
        gap: 8,
        borderRadius: 8,
        margin: 2,
        transition: 'all 0.15s ease',
        color: colors.textPrimary,
    },
    treeItemActive: {
        background: colors.primaryGlow,
        boxShadow: `inset 0 0 0 1.5px ${colors.primary}`,
    },
    expandIcon: {
        width: 16,
        height: 16,
        fontSize: 9,
        color: colors.textMuted,
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        transition: 'all 0.15s ease',
    },
    expandIconPlaceholder: {
        width: 16,
        flexShrink: 0,
    },
    treeNodeName: {
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 500,
        letterSpacing: '-0.01em',
    },
    treeNodeType: {
        fontSize: 10,
        color: colors.textMuted,
        background: colors.bgSecondary,
        padding: '3px 6px',
        borderRadius: 4,
        flexShrink: 0,
        fontWeight: 500,
        letterSpacing: '0.02em',
    },
    annotationBadge: {
        fontSize: 12,
        flexShrink: 0,
        color: colors.primary,
    },
    countBadge: {
        fontSize: 10,
        color: colors.primary,
        background: colors.primarySoft,
        padding: '3px 8px',
        borderRadius: 10,
        fontWeight: 600,
        letterSpacing: '0.02em',
    },

    filterLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 6,
        transition: 'all 0.15s ease',
        fontWeight: 500,
    },
    checkbox: {
        margin: 0,
        accentColor: colors.primary,
        width: 14,
        height: 14,
    },

    activeNodeName: {
        fontWeight: 500,
        color: colors.primary,
        fontSize: 12,
    },
    textarea: {
        width: '100%',
        padding: '12px 14px',
        border: `1.5px solid ${colors.border}`,
        borderRadius: 10,
        fontSize: 13,
        resize: 'vertical',
        boxSizing: 'border-box',
        minHeight: 100,
        fontFamily: 'inherit',
        background: colors.bgPrimary,
        color: colors.textPrimary,
        transition: 'all 0.2s ease',
        outline: 'none',
        lineHeight: 1.5,
    },
    charCount: {
        fontSize: 10,
        color: colors.textMuted,
        textAlign: 'right',
        marginTop: 6,
        fontWeight: 500,
        letterSpacing: '0.02em',
    },
    saveStatusContainer: {
        fontSize: 11,
        fontWeight: 500,
    },
    savingText: {
        color: colors.warning,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    savedText: {
        color: colors.success,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    dirtyText: {
        color: colors.textMuted,
        fontStyle: 'italic',
    },

    placeholder: {
        color: colors.textMuted,
        textAlign: 'center',
        padding: '28px 20px',
        fontSize: 12,
        background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bgPrimary} 100%)`,
        borderRadius: 10,
        border: `1.5px dashed ${colors.border}`,
        letterSpacing: '-0.01em',
    },
    placeholderIcon: {
        fontSize: 24,
        marginBottom: 8,
        opacity: 0.4,
    },

    error: {
        marginTop: 12,
        padding: '12px 14px',
        background: colors.errorBg,
        color: colors.error,
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        border: `1px solid rgba(220, 38, 38, 0.2)`,
    },
    errorIcon: {
        fontSize: 14,
        flexShrink: 0,
    },

    help: {
        marginTop: 16,
        padding: '12px 14px',
        fontSize: 11,
        color: colors.textMuted,
        lineHeight: 1.7,
        background: colors.bgSecondary,
        borderRadius: 10,
        letterSpacing: '-0.01em',
    },
    helpStep: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 6,
    },
    helpNumber: {
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: colors.primarySoft,
        color: colors.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 600,
        flexShrink: 0,
    },
};

export default App;
