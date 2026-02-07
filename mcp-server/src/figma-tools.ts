// ============================================================
// MCP 工具定义 - 提供给 Claude Code 调用
// ============================================================

import { z } from 'zod';
import { dataStore } from './data-store.js';
import { getConnectionCount } from './websocket-server.js';
import {
    readFileSync,
    existsSync,
    writeFileSync,
    mkdirSync,
    statSync,
} from 'fs';
import { dirname, join, resolve } from 'path';
import { createHash } from 'crypto';
import type {
    FigmaNodeData,
    ProjectConfig,
    ComponentMap,
    SyncMapping,
    NodeChange,
} from './types.js';

// ============================================================
// 工具定义
// ============================================================

export const tools = [
    // 1. 获取当前 Figma 选中
    {
        name: 'get_figma_selection',
        description: `获取当前 Figma 插件中选中的节点数据。返回完整的节点树结构，包括：
- 节点基本信息（id, name, type, 尺寸位置）
- 布局属性（Auto Layout 相关）
- 样式（填充、描边、圆角、阴影）
- 文字属性（仅 TEXT 节点）
- 组件实例信息（仅 INSTANCE 节点）
- 导出的资源（图片、图标）`,
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
        handler: async () => {
            const selection = dataStore.getSelection();

            if (!selection) {
                return {
                    success: false,
                    error: 'No selection available. Please select a layer in Figma.',
                    connectionStatus: {
                        pluginConnected: getConnectionCount() > 0,
                    },
                };
            }

            return {
                success: true,
                data: selection.data,
                assets: selection.assets,
                timestamp: selection.timestamp,
                meta: {
                    nodeCount: countNodes(selection.data),
                    assetCount: selection.assets.length,
                },
            };
        },
    },

    // 2. 获取项目配置
    {
        name: 'get_project_config',
        description: `读取项目的代码生成配置文件 (figma-to-code.config.json)。
配置包括：框架类型、样式方案、输出目录、规则文件路径等。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                configPath: {
                    type: 'string',
                    description:
                        '配置文件路径，默认为当前目录下的 figma-to-code.config.json',
                },
            },
        },
        handler: async (args: { configPath?: string }) => {
            const configPath = args.configPath || './figma-to-code.config.json';
            const fullPath = resolve(configPath);

            if (!existsSync(fullPath)) {
                return {
                    success: false,
                    error: `Config file not found: ${fullPath}`,
                    suggestion:
                        'Create a figma-to-code.config.json file in your project root.',
                };
            }

            try {
                const content = readFileSync(fullPath, 'utf-8');
                const config: ProjectConfig = JSON.parse(content);
                return { success: true, config, configPath: fullPath };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to parse config: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    // 3. 获取代码规则
    {
        name: 'get_code_rules',
        description: `读取用户定义的代码生成规则 (markdown 文件)。
支持两层规则：
1. 通用默认规则（code-rules.md，适用于所有项目）
2. 项目级规则（默认 .figma-rules.md，放在目标项目根目录，覆盖/补充通用规则）
返回合并后的规则内容。项目级规则优先级更高。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                rulesPath: {
                    type: 'string',
                    description: '通用规则文件路径，默认从配置文件中读取',
                },
                projectRulesPath: {
                    type: 'string',
                    description:
                        '项目级规则文件路径，默认从配置文件中读取（projectRules 字段）。传入目标项目的根目录路径也可自动查找 .figma-rules.md',
                },
            },
        },
        handler: async (args: {
            rulesPath?: string;
            projectRulesPath?: string;
        }) => {
            let rulesPath = args.rulesPath;
            let projectRulesPath = args.projectRulesPath;

            const configPath = './figma-to-code.config.json';
            if (existsSync(configPath)) {
                try {
                    const config: ProjectConfig = JSON.parse(
                        readFileSync(configPath, 'utf-8'),
                    );
                    if (!rulesPath) rulesPath = config.rules;
                    if (!projectRulesPath)
                        projectRulesPath = config.projectRules;
                } catch {}
            }

            rulesPath = rulesPath || './code-rules.md';
            const baseFullPath = resolve(rulesPath);
            let baseRules = '';

            if (existsSync(baseFullPath)) {
                try {
                    baseRules = readFileSync(baseFullPath, 'utf-8');
                } catch (error) {
                    return {
                        success: false,
                        error: `Failed to read base rules: ${error instanceof Error ? error.message : String(error)}`,
                    };
                }
            }

            let projectRules = '';
            let projectRulesFullPath = '';

            if (projectRulesPath) {
                let candidatePath = resolve(projectRulesPath);
                if (existsSync(candidatePath)) {
                    try {
                        const stat = statSync(candidatePath);
                        if (stat.isDirectory()) {
                            candidatePath = join(
                                candidatePath,
                                '.figma-rules.md',
                            );
                        }
                    } catch {}
                }

                if (existsSync(candidatePath)) {
                    try {
                        projectRules = readFileSync(candidatePath, 'utf-8');
                        projectRulesFullPath = candidatePath;
                    } catch {}
                }
            }

            if (!baseRules && !projectRules) {
                return {
                    success: false,
                    error: 'No rules files found.',
                    suggestion:
                        'Create a code-rules.md (base rules) and/or .figma-rules.md (project rules).',
                };
            }

            const mergedRules = projectRules
                ? `${baseRules}\n\n---\n\n# 项目级规则（覆盖/补充上述通用规则）\n\n> 以下规则来自项目级配置（${projectRulesFullPath}），优先级高于通用规则。\n\n${projectRules}`
                : baseRules;

            return {
                success: true,
                rules: mergedRules,
                baseRulesPath: existsSync(baseFullPath) ? baseFullPath : null,
                projectRulesPath: projectRulesFullPath || null,
                hasProjectRules: !!projectRules,
            };
        },
    },

    // 4. 获取组件映射
    {
        name: 'get_component_mapping',
        description: `获取 Figma 组件到项目组件的映射配置。
用于将 Figma 中的组件实例映射到项目中的实际组件。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                mappingPath: {
                    type: 'string',
                    description: '映射文件路径，默认从配置文件中读取',
                },
            },
        },
        handler: async (args: { mappingPath?: string }) => {
            let mappingPath = args.mappingPath;

            if (!mappingPath) {
                const configPath = './figma-to-code.config.json';
                if (existsSync(configPath)) {
                    try {
                        const config: ProjectConfig = JSON.parse(
                            readFileSync(configPath, 'utf-8'),
                        );
                        mappingPath = config.componentMap;
                    } catch {}
                }
            }

            mappingPath = mappingPath || './component-map.json';
            const fullPath = resolve(mappingPath);

            if (!existsSync(fullPath)) {
                return {
                    success: false,
                    error: `Component mapping file not found: ${fullPath}`,
                    suggestion:
                        'Create a component-map.json file to define mappings.',
                };
            }

            try {
                const content = readFileSync(fullPath, 'utf-8');
                const mapping: ComponentMap = JSON.parse(content);
                return { success: true, mapping, mappingPath: fullPath };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to parse mapping: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    // 5. 检查设计变更
    {
        name: 'check_figma_changes',
        description: `检查当前 Figma 选中内容与上次同步相比有哪些变化。
返回新增、修改、删除的节点列表及受影响的文件。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                syncFilePath: {
                    type: 'string',
                    description: '同步记录文件路径，默认 .figma-sync.json',
                },
            },
        },
        handler: async (args: { syncFilePath?: string }) => {
            const selection = dataStore.getSelection();
            if (!selection) {
                return { success: false, error: 'No selection available' };
            }

            const syncPath = args.syncFilePath || './.figma-sync.json';
            const fullPath = resolve(syncPath);

            if (!existsSync(fullPath)) {
                return {
                    success: true,
                    isFirstSync: true,
                    message:
                        'No previous sync found. All nodes will be treated as new.',
                    changes: {
                        added: flattenNodes(selection.data).map((n) => ({
                            nodeId: n.id,
                            name: n.name,
                            type: n.type,
                        })),
                        modified: [],
                        deleted: [],
                    },
                };
            }

            try {
                const syncData: SyncMapping = JSON.parse(
                    readFileSync(fullPath, 'utf-8'),
                );
                const changes = detectChanges(syncData, selection.data);

                return {
                    success: true,
                    isFirstSync: false,
                    lastSync: syncData.lastSync,
                    changes: {
                        added: changes.filter((c) => c.changeType === 'added'),
                        modified: changes.filter(
                            (c) => c.changeType === 'modified',
                        ),
                        deleted: changes.filter(
                            (c) => c.changeType === 'deleted',
                        ),
                    },
                    summary: {
                        totalChanges: changes.length,
                        affectedFiles: [
                            ...new Set(changes.flatMap((c) => c.affectedFiles)),
                        ],
                    },
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to check changes: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    // 6. 保存生成的代码
    {
        name: 'save_generated_code',
        description: `将生成的代码保存到项目目录，并更新同步记录。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                filePath: {
                    type: 'string',
                    description: '文件保存路径',
                },
                code: {
                    type: 'string',
                    description: '生成的代码内容',
                },
                nodeId: {
                    type: 'string',
                    description: '关联的 Figma 节点 ID（用于增量更新追踪）',
                },
            },
            required: ['filePath', 'code'],
        },
        handler: async (args: {
            filePath: string;
            code: string;
            nodeId?: string;
        }) => {
            const fullPath = resolve(args.filePath);

            try {
                // 确保目录存在
                const dir = dirname(fullPath);
                if (!existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }

                // 写入文件
                writeFileSync(fullPath, args.code, 'utf-8');

                // 如果提供了 nodeId，更新同步记录
                if (args.nodeId) {
                    updateSyncRecord(args.nodeId, fullPath);
                }

                return {
                    success: true,
                    filePath: fullPath,
                    message: `Code saved to ${fullPath}`,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to save code: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    // 7. 保存资源文件
    {
        name: 'save_asset',
        description: `保存导出的资源文件（图片、图标等）到项目目录。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                nodeId: {
                    type: 'string',
                    description: 'Figma 节点 ID',
                },
                outputPath: {
                    type: 'string',
                    description: '输出文件路径',
                },
            },
            required: ['nodeId', 'outputPath'],
        },
        handler: async (args: { nodeId: string; outputPath: string }) => {
            const selection = dataStore.getSelection();
            if (!selection) {
                return { success: false, error: 'No selection available' };
            }

            const asset = selection.assets.find(
                (a) => a.nodeId === args.nodeId,
            );
            if (!asset) {
                return {
                    success: false,
                    error: `Asset not found for node: ${args.nodeId}`,
                };
            }

            const fullPath = resolve(args.outputPath);

            try {
                const dir = dirname(fullPath);
                if (!existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }

                if (asset.format === 'svg') {
                    // SVG 直接写入字符串
                    writeFileSync(fullPath, asset.data, 'utf-8');
                } else {
                    // 其他格式需要从 base64 解码
                    const buffer = Buffer.from(asset.data, 'base64');
                    writeFileSync(fullPath, buffer);
                }

                return {
                    success: true,
                    filePath: fullPath,
                    assetType: asset.type,
                    format: asset.format,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to save asset: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    // 8. 获取服务状态
    {
        name: 'get_server_status',
        description: `获取 MCP Server 状态，包括 Figma 插件连接状态和数据缓存状态。`,
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
        handler: async () => {
            const stats = dataStore.getStats();
            return {
                success: true,
                status: {
                    pluginConnected: getConnectionCount() > 0,
                    connectionCount: getConnectionCount(),
                    hasSelection: stats.hasSelection,
                    historyCount: stats.historyCount,
                    lastUpdate: stats.lastUpdate,
                },
            };
        },
    },
];

// ============================================================
// 辅助函数
// ============================================================

function countNodes(node: FigmaNodeData): number {
    let count = 1;
    if (node.children) {
        for (const child of node.children) {
            count += countNodes(child);
        }
    }
    return count;
}

function flattenNodes(node: FigmaNodeData): FigmaNodeData[] {
    const nodes: FigmaNodeData[] = [node];
    if (node.children) {
        for (const child of node.children) {
            nodes.push(...flattenNodes(child));
        }
    }
    return nodes;
}

function computeNodeHash(node: FigmaNodeData): string {
    const significantProps = {
        type: node.type,
        width: Math.round(node.width),
        height: Math.round(node.height),
        layoutMode: node.layoutMode,
        fills: node.fills,
        strokes: node.strokes,
        effects: node.effects,
        cornerRadius: node.cornerRadius,
        characters: node.characters,
        fontSize: node.fontSize,
        fontName: node.fontName,
        childrenHash: node.children?.map((c) => computeNodeHash(c)).join(','),
    };

    return createHash('md5')
        .update(JSON.stringify(significantProps))
        .digest('hex')
        .slice(0, 12);
}

function detectChanges(
    oldMapping: SyncMapping,
    currentNode: FigmaNodeData,
): NodeChange[] {
    const changes: NodeChange[] = [];
    const currentNodes = flattenNodes(currentNode);
    const currentNodesMap = new Map(currentNodes.map((n) => [n.id, n]));

    // 检测修改和删除
    for (const [nodeId, oldInfo] of Object.entries(oldMapping.nodes)) {
        const newNode = currentNodesMap.get(nodeId);

        if (!newNode) {
            changes.push({
                nodeId,
                changeType: 'deleted',
                affectedFiles: [oldInfo.generatedFile, ...oldInfo.assets],
            });
        } else {
            const newHash = computeNodeHash(newNode);
            if (newHash !== oldInfo.hash) {
                changes.push({
                    nodeId,
                    changeType: 'modified',
                    oldHash: oldInfo.hash,
                    newHash,
                    affectedFiles: [oldInfo.generatedFile],
                });
            }
            currentNodesMap.delete(nodeId);
        }
    }

    // 检测新增
    for (const [nodeId, node] of currentNodesMap) {
        changes.push({
            nodeId,
            changeType: 'added',
            newHash: computeNodeHash(node),
            affectedFiles: [],
        });
    }

    return changes;
}

function updateSyncRecord(nodeId: string, filePath: string): void {
    const syncPath = resolve('./.figma-sync.json');
    let syncData: SyncMapping = {
        lastSync: new Date().toISOString(),
        nodes: {},
    };

    if (existsSync(syncPath)) {
        try {
            syncData = JSON.parse(readFileSync(syncPath, 'utf-8'));
        } catch {}
    }

    const selection = dataStore.getSelection();
    if (selection) {
        const node = flattenNodes(selection.data).find((n) => n.id === nodeId);
        if (node) {
            syncData.nodes[nodeId] = {
                name: node.name,
                hash: computeNodeHash(node),
                generatedFile: filePath,
                assets: [],
            };
            syncData.lastSync = new Date().toISOString();

            writeFileSync(syncPath, JSON.stringify(syncData, null, 2), 'utf-8');
        }
    }
}

// 导出工具 schema（用于 MCP）
export const toolSchemas = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
}));

// 获取工具处理器
export function getToolHandler(
    name: string,
): ((args: Record<string, unknown>) => Promise<unknown>) | undefined {
    const tool = tools.find((t) => t.name === name);
    if (!tool) return undefined;
    // 包装 handler 以接受通用参数类型
    return async (args: Record<string, unknown>) => {
        return tool.handler(args as never);
    };
}
