import {
    readFileSync,
    existsSync,
    writeFileSync,
    mkdirSync,
    readdirSync,
    statSync,
    copyFileSync,
} from 'fs';
import { dirname, join, resolve } from 'path';
import type { WorkspaceConfig, WorkspaceFile } from './types.js';

const WORKSPACE_DIR = '.aiwork';
const CONFIG_FILE = 'config.json';
const FIGMA_RULES_FILE = 'figma-rules.md';
const TECH_RULES_FILE = 'tech-design-rules.md';

function getDefaultsDir(): string {
    return join(dirname(new URL(import.meta.url).pathname), '..', 'defaults');
}

function getWorkspacePath(projectRoot: string): string {
    return join(resolve(projectRoot), WORKSPACE_DIR);
}

function getConfigPath(projectRoot: string): string {
    return join(getWorkspacePath(projectRoot), CONFIG_FILE);
}

function readWorkspaceConfig(projectRoot: string): WorkspaceConfig | null {
    const configPath = getConfigPath(projectRoot);
    if (!existsSync(configPath)) return null;

    try {
        return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
        return null;
    }
}

function listFilesInDir(dir: string, prefix: string = ''): WorkspaceFile[] {
    const files: WorkspaceFile[] = [];
    if (!existsSync(dir)) return files;

    try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);

            if (stat.isFile() && entry.endsWith('.md')) {
                files.push({
                    type: prefix as WorkspaceFile['type'],
                    path: fullPath,
                    name: entry,
                    exists: true,
                    lastModified: stat.mtime.toISOString(),
                });
            }
        }
    } catch {}

    return files;
}

export const workspaceTools = [
    {
        name: 'init_workspace',
        description: `初始化 .aiwork/ 工作区目录。
创建必要的目录结构和默认配置文件：
- .aiwork/config.json - 项目配置
- .aiwork/figma-rules.md - Figma 代码生成规则
- .aiwork/tech-design-rules.md - 技术方案模板
- .aiwork/requirements/ - 需求文档目录
- .aiwork/designs/ - 技术方案目录
- .aiwork/interactions/ - 交互文档目录
- .aiwork/api/ - API 文档目录`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                framework: {
                    type: 'string',
                    description: '项目框架 (react-native, react, vue, flutter)',
                },
                projectName: {
                    type: 'string',
                    description: '项目名称',
                },
                force: {
                    type: 'boolean',
                    description: '是否覆盖已存在的配置',
                },
            },
        },
        handler: async (args: {
            projectRoot?: string;
            framework?: string;
            projectName?: string;
            force?: boolean;
        }) => {
            const projectRoot = args.projectRoot || '.';
            const workspacePath = getWorkspacePath(projectRoot);
            const configPath = getConfigPath(projectRoot);

            if (existsSync(configPath) && !args.force) {
                return {
                    success: false,
                    error: 'Workspace already initialized',
                    suggestion: 'Use force=true to overwrite existing config',
                    configPath,
                };
            }

            try {
                const dirs = [
                    workspacePath,
                    join(workspacePath, 'requirements'),
                    join(workspacePath, 'designs'),
                    join(workspacePath, 'interactions'),
                    join(workspacePath, 'api'),
                ];

                for (const dir of dirs) {
                    if (!existsSync(dir)) {
                        mkdirSync(dir, { recursive: true });
                    }
                }

                const defaultsDir = getDefaultsDir();
                const defaultConfig: WorkspaceConfig = {
                    projectName: args.projectName || dirname(resolve(projectRoot)).split('/').pop() || 'project',
                    framework: args.framework || 'react-native',
                    styling: {
                        type: 'stylesheet',
                        unit: 'dp',
                    },
                    output: {
                        componentDir: './src/components',
                        screenDir: './src/screens',
                        assetDir: './src/assets',
                    },
                    stateManagement: 'zustand',
                    docs: {
                        requirementsDir: 'requirements',
                        designsDir: 'designs',
                        interactionsDir: 'interactions',
                        apiDir: 'api',
                    },
                };

                writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');

                const defaultCodeRules = join(defaultsDir, 'code-rules.md');
                const targetFigmaRules = join(workspacePath, FIGMA_RULES_FILE);
                if (existsSync(defaultCodeRules) && !existsSync(targetFigmaRules)) {
                    copyFileSync(defaultCodeRules, targetFigmaRules);
                }

                const defaultTechRules = join(defaultsDir, 'tech-design-rules.md');
                const targetTechRules = join(workspacePath, TECH_RULES_FILE);
                if (existsSync(defaultTechRules) && !existsSync(targetTechRules)) {
                    copyFileSync(defaultTechRules, targetTechRules);
                }

                return {
                    success: true,
                    message: 'Workspace initialized successfully',
                    workspacePath,
                    createdFiles: [
                        configPath,
                        existsSync(targetFigmaRules) ? targetFigmaRules : null,
                        existsSync(targetTechRules) ? targetTechRules : null,
                    ].filter(Boolean),
                    directories: dirs,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to initialize workspace: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    {
        name: 'get_workspace_config',
        description: `读取 .aiwork/config.json 工作区配置。
配置包括：项目名称、框架类型、样式方案、输出目录、状态管理、文档目录等。`,
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
            const configPath = getConfigPath(projectRoot);

            if (!existsSync(configPath)) {
                return {
                    success: false,
                    error: 'Workspace not initialized',
                    suggestion: 'Run init_workspace to create .aiwork/ directory',
                };
            }

            try {
                const config = readWorkspaceConfig(projectRoot);
                if (!config) {
                    return {
                        success: false,
                        error: 'Failed to parse config file',
                    };
                }

                return {
                    success: true,
                    config,
                    configPath,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to read config: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    {
        name: 'list_workspace_files',
        description: `列出 .aiwork/ 工作区中的所有文件。
返回配置文件、规则文件、需求文档、技术方案、交互文档、API 文档等。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                type: {
                    type: 'string',
                    description: '过滤文件类型 (requirement, design, interaction, api)',
                },
            },
        },
        handler: async (args: { projectRoot?: string; type?: string }) => {
            const projectRoot = args.projectRoot || '.';
            const workspacePath = getWorkspacePath(projectRoot);

            if (!existsSync(workspacePath)) {
                return {
                    success: false,
                    error: 'Workspace not initialized',
                    suggestion: 'Run init_workspace first',
                };
            }

            const files: WorkspaceFile[] = [];
            const config = readWorkspaceConfig(projectRoot);

            const configFilePath = getConfigPath(projectRoot);
            if (existsSync(configFilePath)) {
                const stat = statSync(configFilePath);
                files.push({
                    type: 'config',
                    path: configFilePath,
                    name: CONFIG_FILE,
                    exists: true,
                    lastModified: stat.mtime.toISOString(),
                });
            }

            const figmaRulesPath = join(workspacePath, FIGMA_RULES_FILE);
            if (existsSync(figmaRulesPath)) {
                const stat = statSync(figmaRulesPath);
                files.push({
                    type: 'figma-rules',
                    path: figmaRulesPath,
                    name: FIGMA_RULES_FILE,
                    exists: true,
                    lastModified: stat.mtime.toISOString(),
                });
            }

            const techRulesPath = join(workspacePath, TECH_RULES_FILE);
            if (existsSync(techRulesPath)) {
                const stat = statSync(techRulesPath);
                files.push({
                    type: 'tech-rules',
                    path: techRulesPath,
                    name: TECH_RULES_FILE,
                    exists: true,
                    lastModified: stat.mtime.toISOString(),
                });
            }

            const docDirs: Array<{ dir: string; type: WorkspaceFile['type'] }> = [
                { dir: config?.docs?.requirementsDir || 'requirements', type: 'requirement' },
                { dir: config?.docs?.designsDir || 'designs', type: 'design' },
                { dir: config?.docs?.interactionsDir || 'interactions', type: 'interaction' },
                { dir: config?.docs?.apiDir || 'api', type: 'api' },
            ];

            for (const { dir, type } of docDirs) {
                if (args.type && args.type !== type) continue;
                const fullDir = join(workspacePath, dir);
                files.push(...listFilesInDir(fullDir, type));
            }

            return {
                success: true,
                workspacePath,
                files,
                summary: {
                    total: files.length,
                    byType: files.reduce((acc, f) => {
                        acc[f.type] = (acc[f.type] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>),
                },
            };
        },
    },
];

export const workspaceToolSchemas = workspaceTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
}));

export function getWorkspaceToolHandler(
    name: string,
): ((args: Record<string, unknown>) => Promise<unknown>) | undefined {
    const tool = workspaceTools.find((t) => t.name === name);
    if (!tool) return undefined;
    return async (args: Record<string, unknown>) => {
        return tool.handler(args as never);
    };
}
