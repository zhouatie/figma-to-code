// ============================================================
// MCP 工具定义 - 提供给 Claude Code 调用
// ============================================================

import { dataStore } from './data-store.js';
import { getConnectionCount } from './websocket-server.js';
import {
    readFileSync,
    existsSync,
    writeFileSync,
    mkdirSync,
    readdirSync,
} from 'fs';
import { dirname, join, resolve } from 'path';
import type {
    FigmaNodeData,
    ComponentMap,
} from './types.js';
import {
    FIGMA_RULES_FILE,
    getDefaultsDir,
    getWorkspacePath,
    readWorkspaceConfig,
} from './constants.js';

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
- AI 标注（用户为节点添加的处理说明，annotation 字段）
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
                    annotations: collectAnnotations(selection.data),
                },
            };
        },
    },

    // 获取代码规则
    {
        name: 'get_code_rules',
        description: `读取代码生成规则 (markdown 文件)。
规则来源：
1. 默认规则（内置 defaults/code-rules.md）
2. 框架规则（内置 defaults/framework-rules/<framework>.md，暂未实现）
3. 项目级规则（.aiwork/figma-rules.md，优先级最高）
返回合并后的规则内容。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                framework: {
                    type: 'string',
                    description: '目标框架（如 react-native），默认从配置文件读取',
                },
            },
        },
        handler: async (args: {
            projectRoot?: string;
            framework?: string;
        }) => {
            const projectRoot = args.projectRoot || '.';
            const workspacePath = getWorkspacePath(projectRoot);
            const defaultsDir = getDefaultsDir();

            let framework = args.framework;
            const config = readWorkspaceConfig(projectRoot);
            if (!framework && config) {
                framework = config.framework;
            }
            framework = framework || 'react-native';

            let baseRules = '';
            let projectRules = '';
            let baseFullPath = '';
            let projectFullPath = '';

            const defaultRulesPath = join(defaultsDir, 'code-rules.md');
            if (existsSync(defaultRulesPath)) {
                try {
                    baseRules = readFileSync(defaultRulesPath, 'utf-8');
                    baseFullPath = defaultRulesPath;
                } catch {}
            }

            const projectRulesPath = join(workspacePath, FIGMA_RULES_FILE);
            if (existsSync(projectRulesPath)) {
                try {
                    projectRules = readFileSync(projectRulesPath, 'utf-8');
                    projectFullPath = projectRulesPath;
                } catch {}
            }

            if (!baseRules && !projectRules) {
                return {
                    success: false,
                    error: 'No rules files found.',
                    suggestion: 'Run init_workspace to create .aiwork/ with default rules',
                };
            }

            let mergedRules = baseRules;

            if (projectRules) {
                mergedRules += `\n\n---\n\n# 项目级规则\n\n> 以下规则来自项目配置（${projectFullPath}），优先级最高\n\n${projectRules}`;
            }

            return {
                success: true,
                rules: mergedRules,
                framework,
                layers: {
                    base: baseFullPath || null,
                    project: projectFullPath || null,
                },
            };
        },
    },

    // 获取组件映射
    {
        name: 'get_component_mapping',
        description: `获取 Figma 组件到目标框架组件的映射配置。
根据框架自动加载对应的组件映射文件（defaults/component-maps/<framework>.json）。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                framework: {
                    type: 'string',
                    description: '目标框架（如 react-native），默认从配置文件读取',
                },
            },
        },
        handler: async (args: { projectRoot?: string; framework?: string }) => {
            const projectRoot = args.projectRoot || '.';
            const defaultsDir = getDefaultsDir();

            let framework = args.framework;
            const config = readWorkspaceConfig(projectRoot);
            if (!framework && config) {
                framework = config.framework;
            }
            framework = framework || 'react-native';

            const componentMapsDir = join(defaultsDir, 'component-maps');
            const mappingPath = join(componentMapsDir, `${framework}.json`);

            if (!existsSync(mappingPath)) {
                const availableFrameworks = existsSync(componentMapsDir)
                    ? readdirSync(componentMapsDir)
                          .filter((f: string) => f.endsWith('.json'))
                          .map((f: string) => f.replace('.json', ''))
                    : [];

                return {
                    success: false,
                    error: `Component mapping not found for framework "${framework}"`,
                    suggestion: `Available frameworks: ${availableFrameworks.join(', ') || 'none'}`,
                    availableFrameworks,
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

    // 保存资源文件
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

    // 获取服务状态
    {
        name: 'get_server_status',
        description: `获取 MCP Server 状态，包括 Figma 插件连接状态、数据缓存状态和工作区状态。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
            },
        },
        handler: async (args: { projectRoot?: string }) => {
            const projectRoot = args.projectRoot || '.';
            const stats = dataStore.getStats();
            const workspacePath = getWorkspacePath(projectRoot);
            const config = readWorkspaceConfig(projectRoot);

            return {
                success: true,
                status: {
                    pluginConnected: getConnectionCount() > 0,
                    connectionCount: getConnectionCount(),
                    hasSelection: stats.hasSelection,
                    historyCount: stats.historyCount,
                    lastUpdate: stats.lastUpdate,
                },
                workspace: {
                    initialized: config !== null,
                    path: workspacePath,
                    config: config ? {
                        projectName: config.projectName,
                        framework: config.framework,
                        stateManagement: config.stateManagement,
                    } : null,
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

interface AnnotationSummary {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    annotation: string;
}

function collectAnnotations(node: FigmaNodeData): AnnotationSummary[] {
    const results: AnnotationSummary[] = [];

    function traverse(n: FigmaNodeData): void {
        if (n.annotation) {
            results.push({
                nodeId: n.id,
                nodeName: n.name,
                nodeType: n.type,
                annotation: n.annotation,
            });
        }
        if (n.children) {
            for (const child of n.children) {
                traverse(child);
            }
        }
    }

    traverse(node);
    return results;
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
