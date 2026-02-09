import {
    readFileSync,
    existsSync,
    writeFileSync,
    mkdirSync,
    readdirSync,
    statSync,
} from 'fs';
import { join, basename } from 'path';
import {
    TECH_RULES_FILE,
    getDefaultsDir,
    getWorkspacePath,
    readWorkspaceConfig,
} from './constants.js';

function ensureDir(dir: string): void {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

function listMarkdownFiles(dir: string): Array<{ name: string; path: string; lastModified: string }> {
    if (!existsSync(dir)) return [];

    try {
        return readdirSync(dir)
            .filter((f) => f.endsWith('.md'))
            .map((f) => {
                const fullPath = join(dir, f);
                const stat = statSync(fullPath);
                return {
                    name: f,
                    path: fullPath,
                    lastModified: stat.mtime.toISOString(),
                };
            });
    } catch {
        return [];
    }
}

export const designTools = [
    {
        name: 'get_requirement',
        description: `读取需求文档。
从 .aiwork/requirements/ 目录读取指定的需求文档。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                name: {
                    type: 'string',
                    description: '需求文档名称（不含 .md 后缀）',
                },
            },
            required: ['name'],
        },
        handler: async (args: { projectRoot?: string; name: string }) => {
            const projectRoot = args.projectRoot || '.';
            const workspacePath = getWorkspacePath(projectRoot);
            const config = readWorkspaceConfig(projectRoot);
            const requirementsDir = join(workspacePath, config?.docs?.requirementsDir || 'requirements');

            const fileName = args.name.endsWith('.md') ? args.name : `${args.name}.md`;
            const filePath = join(requirementsDir, fileName);

            if (!existsSync(filePath)) {
                const available = listMarkdownFiles(requirementsDir);
                return {
                    success: false,
                    error: `Requirement not found: ${fileName}`,
                    availableFiles: available.map((f) => f.name),
                };
            }

            try {
                const content = readFileSync(filePath, 'utf-8');
                return {
                    success: true,
                    name: args.name,
                    content,
                    filePath,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to read requirement: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    {
        name: 'get_tech_design',
        description: `读取技术方案文档。
从 .aiwork/designs/ 目录读取指定的技术方案。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                name: {
                    type: 'string',
                    description: '技术方案名称（不含 .md 后缀）',
                },
            },
            required: ['name'],
        },
        handler: async (args: { projectRoot?: string; name: string }) => {
            const projectRoot = args.projectRoot || '.';
            const workspacePath = getWorkspacePath(projectRoot);
            const config = readWorkspaceConfig(projectRoot);
            const designsDir = join(workspacePath, config?.docs?.designsDir || 'designs');

            const fileName = args.name.endsWith('.md') ? args.name : `${args.name}.md`;
            const filePath = join(designsDir, fileName);

            if (!existsSync(filePath)) {
                const available = listMarkdownFiles(designsDir);
                return {
                    success: false,
                    error: `Tech design not found: ${fileName}`,
                    availableFiles: available.map((f) => f.name),
                };
            }

            try {
                const content = readFileSync(filePath, 'utf-8');
                return {
                    success: true,
                    name: args.name,
                    content,
                    filePath,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to read tech design: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    {
        name: 'get_interaction_spec',
        description: `读取交互文档。
从 .aiwork/interactions/ 目录读取指定的交互说明。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                name: {
                    type: 'string',
                    description: '交互文档名称（不含 .md 后缀）',
                },
            },
            required: ['name'],
        },
        handler: async (args: { projectRoot?: string; name: string }) => {
            const projectRoot = args.projectRoot || '.';
            const workspacePath = getWorkspacePath(projectRoot);
            const config = readWorkspaceConfig(projectRoot);
            const interactionsDir = join(workspacePath, config?.docs?.interactionsDir || 'interactions');

            const fileName = args.name.endsWith('.md') ? args.name : `${args.name}.md`;
            const filePath = join(interactionsDir, fileName);

            if (!existsSync(filePath)) {
                const available = listMarkdownFiles(interactionsDir);
                return {
                    success: false,
                    error: `Interaction spec not found: ${fileName}`,
                    availableFiles: available.map((f) => f.name),
                };
            }

            try {
                const content = readFileSync(filePath, 'utf-8');
                return {
                    success: true,
                    name: args.name,
                    content,
                    filePath,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to read interaction spec: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    {
        name: 'get_api_spec',
        description: `读取 API 接口文档。
从 .aiwork/api/ 目录读取指定的接口文档。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                name: {
                    type: 'string',
                    description: 'API 文档名称（不含 .md 后缀）',
                },
            },
            required: ['name'],
        },
        handler: async (args: { projectRoot?: string; name: string }) => {
            const projectRoot = args.projectRoot || '.';
            const workspacePath = getWorkspacePath(projectRoot);
            const config = readWorkspaceConfig(projectRoot);
            const apiDir = join(workspacePath, config?.docs?.apiDir || 'api');

            const fileName = args.name.endsWith('.md') ? args.name : `${args.name}.md`;
            const filePath = join(apiDir, fileName);

            if (!existsSync(filePath)) {
                const available = listMarkdownFiles(apiDir);
                return {
                    success: false,
                    error: `API spec not found: ${fileName}`,
                    availableFiles: available.map((f) => f.name),
                };
            }

            try {
                const content = readFileSync(filePath, 'utf-8');
                return {
                    success: true,
                    name: args.name,
                    content,
                    filePath,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to read API spec: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    {
        name: 'save_document',
        description: `保存文档到 .aiwork/ 工作区。
支持保存需求文档、技术方案、交互文档、API 文档。`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                projectRoot: {
                    type: 'string',
                    description: '目标项目根目录，默认为当前目录',
                },
                type: {
                    type: 'string',
                    description: '文档类型: requirement, design, interaction, api',
                },
                name: {
                    type: 'string',
                    description: '文档名称（不含 .md 后缀）',
                },
                content: {
                    type: 'string',
                    description: '文档内容',
                },
            },
            required: ['type', 'name', 'content'],
        },
        handler: async (args: {
            projectRoot?: string;
            type: string;
            name: string;
            content: string;
        }) => {
            const projectRoot = args.projectRoot || '.';
            const workspacePath = getWorkspacePath(projectRoot);
            const config = readWorkspaceConfig(projectRoot);

            const dirMap: Record<string, string> = {
                requirement: config?.docs?.requirementsDir || 'requirements',
                design: config?.docs?.designsDir || 'designs',
                interaction: config?.docs?.interactionsDir || 'interactions',
                api: config?.docs?.apiDir || 'api',
            };

            const subDir = dirMap[args.type];
            if (!subDir) {
                return {
                    success: false,
                    error: `Invalid document type: ${args.type}`,
                    validTypes: Object.keys(dirMap),
                };
            }

            const targetDir = join(workspacePath, subDir);
            ensureDir(targetDir);

            const fileName = args.name.endsWith('.md') ? args.name : `${args.name}.md`;
            const filePath = join(targetDir, fileName);

            try {
                writeFileSync(filePath, args.content, 'utf-8');
                return {
                    success: true,
                    message: `Document saved successfully`,
                    filePath,
                    type: args.type,
                    name: basename(fileName, '.md'),
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to save document: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    },

    {
        name: 'get_tech_design_rules',
        description: `读取技术方案生成规则/模板。
返回用于生成技术方案的模板和规范。`,
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
            const workspacePath = getWorkspacePath(projectRoot);
            const defaultsDir = getDefaultsDir();

            let rules = '';
            let rulesPath = '';

            const projectRulesPath = join(workspacePath, TECH_RULES_FILE);
            if (existsSync(projectRulesPath)) {
                try {
                    rules = readFileSync(projectRulesPath, 'utf-8');
                    rulesPath = projectRulesPath;
                } catch {}
            }

            if (!rules) {
                const defaultRulesPath = join(defaultsDir, TECH_RULES_FILE);
                if (existsSync(defaultRulesPath)) {
                    try {
                        rules = readFileSync(defaultRulesPath, 'utf-8');
                        rulesPath = defaultRulesPath;
                    } catch {}
                }
            }

            if (!rules) {
                return {
                    success: false,
                    error: 'Tech design rules not found',
                    suggestion: 'Create .aiwork/tech-design-rules.md or run init_workspace',
                };
            }

            return {
                success: true,
                rules,
                rulesPath,
            };
        },
    },
];

export const designToolSchemas = designTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
}));

export function getDesignToolHandler(
    name: string,
): ((args: Record<string, unknown>) => Promise<unknown>) | undefined {
    const tool = designTools.find((t) => t.name === name);
    if (!tool) return undefined;
    return async (args: Record<string, unknown>) => {
        return tool.handler(args as never);
    };
}
