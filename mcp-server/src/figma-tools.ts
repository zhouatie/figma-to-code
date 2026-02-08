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
    readdirSync,
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
        description: `读取代码生成规则 (markdown 文件)。
支持三层规则合并：
1. 通用基础规则（code-rules.md，框架无关）
2. 框架规则（framework-rules/<framework>.md，如 react-native.md）
3. 项目级规则（.figma-rules.md，放在目标项目根目录）
返回合并后的规则内容。优先级递增，后者覆盖前者。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                framework: {
                    type: 'string',
                    description:
                        '目标框架（如 react-native、react、flutter），默认从配置文件读取',
                },
                projectRulesPath: {
                    type: 'string',
                    description: '项目级规则文件路径或目标项目根目录路径',
                },
            },
        },
        handler: async (args: {
            framework?: string;
            projectRulesPath?: string;
        }) => {
            let framework = args.framework;
            let projectRulesPath = args.projectRulesPath;
            let baseRulesPath = './code-rules.md';
            let frameworkRulesDir = './framework-rules';

            const configPath = './figma-to-code.config.json';
            if (existsSync(configPath)) {
                try {
                    const config: ProjectConfig = JSON.parse(
                        readFileSync(configPath, 'utf-8'),
                    );
                    if (!framework) framework = config.framework;
                    if (config.rules) baseRulesPath = config.rules;
                    if (config.frameworkRulesDir)
                        frameworkRulesDir = config.frameworkRulesDir;
                    if (!projectRulesPath)
                        projectRulesPath = config.projectRules;
                } catch {}
            }

            framework = framework || 'react-native';

            let baseRules = '';
            let frameworkRules = '';
            let projectRules = '';
            let baseFullPath = resolve(baseRulesPath);
            let frameworkFullPath = '';
            let projectFullPath = '';

            if (existsSync(baseFullPath)) {
                try {
                    baseRules = readFileSync(baseFullPath, 'utf-8');
                } catch {}
            }

            const frameworkRulesPath = join(
                resolve(frameworkRulesDir),
                `${framework}.md`,
            );
            if (existsSync(frameworkRulesPath)) {
                try {
                    frameworkRules = readFileSync(frameworkRulesPath, 'utf-8');
                    frameworkFullPath = frameworkRulesPath;
                } catch {}
            }

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
                        projectFullPath = candidatePath;
                    } catch {}
                }
            }

            if (!baseRules && !frameworkRules && !projectRules) {
                return {
                    success: false,
                    error: 'No rules files found.',
                    suggestion:
                        'Create code-rules.md and/or framework-rules/<framework>.md',
                };
            }

            let mergedRules = baseRules;

            if (frameworkRules) {
                mergedRules += `\n\n---\n\n# ${framework} 框架规则\n\n> 以下规则来自框架配置（${frameworkFullPath}）\n\n${frameworkRules}`;
            }

            if (projectRules) {
                mergedRules += `\n\n---\n\n# 项目级规则\n\n> 以下规则来自项目配置（${projectFullPath}），优先级最高\n\n${projectRules}`;
            }

            return {
                success: true,
                rules: mergedRules,
                framework,
                layers: {
                    base: existsSync(baseFullPath) ? baseFullPath : null,
                    framework: frameworkFullPath || null,
                    project: projectFullPath || null,
                },
            };
        },
    },

    // 4. 获取组件映射
    {
        name: 'get_component_mapping',
        description: `获取 Figma 组件到目标框架组件的映射配置。
根据配置的 framework 自动加载对应的组件映射文件（component-maps/<framework>.json）。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                framework: {
                    type: 'string',
                    description:
                        '目标框架（如 react-native、react、flutter），默认从配置文件读取',
                },
            },
        },
        handler: async (args: { framework?: string }) => {
            let framework = args.framework;
            let componentMapsDir = './component-maps';

            const configPath = './figma-to-code.config.json';
            if (existsSync(configPath)) {
                try {
                    const config: ProjectConfig = JSON.parse(
                        readFileSync(configPath, 'utf-8'),
                    );
                    if (!framework) framework = config.framework;
                    if (config.componentMapsDir)
                        componentMapsDir = config.componentMapsDir;
                } catch {}
            }

            framework = framework || 'react-native';

            const mappingPath = join(
                resolve(componentMapsDir),
                `${framework}.json`,
            );

            if (!existsSync(mappingPath)) {
                return {
                    success: false,
                    error: `Component mapping file not found for framework "${framework}": ${mappingPath}`,
                    suggestion: `Create ${componentMapsDir}/${framework}.json to define component mappings.`,
                    availableFrameworks: existsSync(resolve(componentMapsDir))
                        ? readdirSync(resolve(componentMapsDir))
                              .filter((f: string) => f.endsWith('.json'))
                              .map((f: string) => f.replace('.json', ''))
                        : [],
                };
            }

            try {
                const content = readFileSync(mappingPath, 'utf-8');
                const mapping: ComponentMap = JSON.parse(content);
                return {
                    success: true,
                    mapping,
                    framework,
                    mappingPath,
                };
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
