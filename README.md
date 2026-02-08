# AI Work MCP Server (aiwork-mcp)

## 背景

不想把时间浪费在画非常简单的页面上。

## 功能介绍

本项目是一个 **AI 前端开发工作台**，覆盖完整开发流程：

```
PRD 需求文档 → 技术方案 → Figma 静态 UI → 交互代码
```

通过 Figma 插件 + MCP Server 解决方案，让支持 MCP 协议的 AI 编程工具（如 Claude Code、OpenCode 等）能够：

- 读取需求文档，生成技术方案
- 实时获取 Figma 设计稿数据
- 结合技术方案和 API 文档生成交互代码

**核心优势**：使用 Figma Plugin API 而非 REST API。

## 项目结构

```
figma-plugin/
├── plugin/                      # Figma 插件
│   ├── manifest.json
│   └── src/
│
├── mcp-server/                  # MCP 服务端 (aiwork-mcp)
│   ├── src/
│   │   ├── index.ts             # MCP 入口
│   │   ├── websocket-server.ts  # WebSocket 服务
│   │   ├── figma-tools.ts       # Figma 相关工具
│   │   ├── workspace-tools.ts   # 工作区工具
│   │   ├── design-tools.ts      # 文档工具
│   │   ├── data-store.ts        # 数据缓存
│   │   └── types.ts             # 类型定义
│   ├── defaults/                # 默认配置和规则
│   │   ├── code-rules.md        # 代码生成规则
│   │   ├── tech-design-rules.md # 技术方案模板
│   │   ├── config.json          # 默认配置
│   │   └── component-maps/      # 组件映射
│   └── package.json
│
├── framework-rules/             # 框架特定规则（可选）
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd plugin && npm install
cd ../mcp-server && npm install
```

### 2. 构建项目

```bash
cd plugin && npm run build
cd ../mcp-server && npm run build
```

### 3. 配置 Figma 插件

1. 打开 Figma Desktop
2. 进入 Plugins > Development > Import plugin from manifest...
3. 选择 `plugin/manifest.json`

### 4. 配置 AI 编程工具

#### Claude Code

在 `~/.claude/settings.json` 中添加：

```json
{
    "mcpServers": {
        "aiwork": {
            "command": "node",
            "args": ["/path/to/figma-plugin/mcp-server/dist/index.js"]
        }
    }
}
```

#### OpenCode

在 `~/.config/opencode/config.json` 中添加：

```json
{
    "mcpServers": {
        "aiwork": {
            "command": "node",
            "args": ["/path/to/figma-plugin/mcp-server/dist/index.js"]
        }
    }
}
```

### 5. 初始化工作区

在目标项目中，让 AI 调用 `init_workspace` 工具，会自动创建：

```
目标项目/.aiwork/
├── config.json              # 项目配置
├── figma-rules.md           # Figma 代码生成规则
├── tech-design-rules.md     # 技术方案模板
├── requirements/            # 需求文档目录
├── designs/                 # 技术方案目录
├── interactions/            # 交互文档目录
└── api/                     # API 文档目录
```

## 工作区配置

### .aiwork/config.json

```json
{
    "projectName": "my-app",
    "framework": "react-native",
    "styling": {
        "type": "stylesheet",
        "unit": "dp"
    },
    "output": {
        "componentDir": "./src/components",
        "screenDir": "./src/screens",
        "assetDir": "./src/assets"
    },
    "stateManagement": "zustand",
    "networkLib": "axios",
    "navigation": "react-navigation",
    "docs": {
        "requirementsDir": "requirements",
        "designsDir": "designs",
        "interactionsDir": "interactions",
        "apiDir": "api"
    }
}
```

## MCP 工具列表

### Figma 相关

| 工具名                  | 说明                        |
| ----------------------- | --------------------------- |
| `get_figma_selection`   | 获取当前 Figma 选中的节点   |
| `get_code_rules`        | 读取代码生成规则            |
| `get_component_mapping` | 获取组件映射配置            |
| `check_figma_changes`   | 检查设计变更（增量更新）    |
| `save_generated_code`   | 保存生成的代码              |
| `save_asset`            | 保存资源文件                |
| `get_server_status`     | 获取服务状态                |

### 工作区相关

| 工具名                 | 说明                        |
| ---------------------- | --------------------------- |
| `init_workspace`       | 初始化 .aiwork 工作区       |
| `get_workspace_config` | 读取工作区配置              |
| `list_workspace_files` | 列出工作区文件              |

### 文档相关

| 工具名                 | 说明                        |
| ---------------------- | --------------------------- |
| `get_requirement`      | 读取需求文档                |
| `get_tech_design`      | 读取技术方案                |
| `get_interaction_spec` | 读取交互文档                |
| `get_api_spec`         | 读取 API 文档               |
| `save_document`        | 保存文档                    |
| `get_tech_design_rules`| 获取技术方案生成规则        |

## 使用流程

### 流程 1：需求 → 技术方案

```
1. 将需求文档放入 .aiwork/requirements/
2. AI 调用 get_requirement 读取需求
3. AI 调用 get_tech_design_rules 获取模板
4. AI 生成技术方案，调用 save_document 保存到 .aiwork/designs/
```

### 流程 2：技术方案 + Figma → 交互代码

```
1. AI 调用 get_tech_design 读取技术方案
2. AI 调用 get_api_spec 读取 API 文档（如有）
3. 在 Figma 中选中页面，数据自动同步
4. AI 调用 get_figma_selection 获取设计数据
5. AI 调用 get_code_rules 获取代码规范
6. AI 展示组件拆分方案，等待用户确认
7. 确认后生成带交互逻辑的代码
```

## 开发模式

```bash
# 插件开发（热更新）
cd plugin && npm run dev

# MCP Server 开发
cd mcp-server && npm run dev
```

## 技术文档

详细的技术设计请查看 [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md)
