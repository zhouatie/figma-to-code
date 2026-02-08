# Figma to Code

## 背景

不想把时间浪费在画非常简单的页面上。

## 功能介绍

本项目是一个 Figma 插件 + MCP Server 解决方案，让支持 MCP 协议的 AI 编程工具（如 Claude Code、OpenCode 等）能够实时获取 Figma 设计稿数据并生成代码。

**核心优势**：使用 Figma Plugin API 而非 REST API。

## 项目结构

```
figma-plugin/
├── plugin/                      # Figma 插件
│   ├── manifest.json            # 插件配置
│   ├── src/
│   │   ├── code.ts              # Sandbox 主逻辑
│   │   ├── ui.tsx               # UI 界面
│   │   ├── extractor.ts         # 节点数据提取器
│   │   └── types.ts             # 类型定义
│   └── package.json
│
├── mcp-server/                  # MCP 服务端
│   ├── src/
│   │   ├── index.ts             # MCP 入口
│   │   ├── websocket-server.ts  # WebSocket 服务
│   │   ├── figma-tools.ts       # MCP 工具定义
│   │   └── data-store.ts        # 数据缓存
│   └── package.json
│
├── framework-rules/             # 框架特定规则
│   └── react-native.md          # React Native 规则
│
├── component-maps/              # 框架组件映射
│   └── react-native.json        # React Native 组件映射
│
├── figma-to-code.config.json    # 项目配置
├── code-rules.md                # 通用代码生成规则（框架无关）
├── TECHNICAL_DESIGN.md          # 技术设计文档
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
# 安装插件依赖
cd plugin && npm install

# 安装 MCP Server 依赖
cd ../mcp-server && npm install
```

### 2. 构建项目

```bash
# 构建插件
cd plugin && npm run build

# 构建 MCP Server
cd ../mcp-server && npm run build
```

### 3. 配置 Figma 插件

1. 打开 Figma Desktop
2. 进入 Plugins > Development > Import plugin from manifest...
3. 选择 `plugin/manifest.json`

### 4. 配置 AI 编程工具

MCP Server 通过 stdio 协议与 AI 工具通信，由 AI 工具自动启动为子进程，无需手动运行。

#### Claude Code

在 `~/.claude/settings.json` 中添加：

```json
{
    "mcpServers": {
        "figma": {
            "command": "node",
            "args": ["/path/to/figma-plugin/mcp-server/dist/index.js"]
        }
    }
}
```

#### OpenCode

在 OpenCode 配置文件中添加（通常为 `~/.config/opencode/config.json`）：

```json
{
    "mcpServers": {
        "figma": {
            "command": "node",
            "args": ["/path/to/figma-plugin/mcp-server/dist/index.js"]
        }
    }
}
```

> 配置完成后，AI 工具启动时会自动拉起 MCP Server（含 WebSocket 服务），无需手动 `npm start`。

### 5. 启动使用

```bash
# 启动 MCP Server（开发调试时手动运行，正常使用由 AI 工具自动启动）
cd mcp-server && npm start
```

然后：

1. 在 Figma 中打开插件
2. 点击"连接服务器"
3. 选中 Figma 图层（自动同步到 MCP Server）
4. 在 AI 编程工具中请求生成代码

## 配置说明

### figma-to-code.config.json

```json
{
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
    "assets": {
        "images": {
            "outputDir": "./src/assets/images",
            "naming": "kebab-case",
            "scales": [1, 2, 3],
            "reference": "require"
        },
        "icons": {
            "strategy": "icon-component",
            "componentImport": "@/components/Icon",
            "svgDir": "./src/assets/icons"
        }
    },
    "rules": "./code-rules.md",
    "frameworkRulesDir": "./framework-rules",
    "componentMapsDir": "./component-maps",
    "projectRules": ".figma-rules.md"
}
```

### code-rules.md

定义代码生成的规范，采用**三层规则机制**：

1. **通用基础规则**（`code-rules.md`）：框架无关的通用规范（目录结构、命名、代码质量等）
2. **框架规则**（`framework-rules/<framework>.md`）：框架特定规则（如 React Native 的 StyleSheet、View/Text 等）
3. **项目级规则**（`.figma-rules.md`）：放在目标项目根目录，可覆盖/补充上述规则，优先级最高

规则内容包括：

- **工作流规则**：生成代码前必须先展示方案并等待用户确认
- 命名规范
- 布局偏好
- 组件拆分策略
- 框架特定规则

### framework-rules/

框架特定的代码生成规则，按框架命名：

- `react-native.md` - React Native 规则（StyleSheet、View/Text、FlatList 等）
- `react.md` - React/Web 规则（待添加）
- `flutter.md` - Flutter 规则（待添加）

### component-maps/

框架特定的组件映射配置，按框架命名：

- `react-native.json` - Figma 节点到 RN 组件的映射
- `react.json` - Figma 节点到 React/Web 组件的映射（待添加）
- `flutter.json` - Figma 节点到 Flutter Widget 的映射（待添加）

## MCP 工具列表

| 工具名                  | 说明                          |
| ----------------------- | ----------------------------- |
| `get_figma_selection`   | 获取当前 Figma 选中的节点数据 |
| `get_project_config`    | 读取项目配置                  |
| `get_code_rules`        | 读取代码生成规则              |
| `get_component_mapping` | 获取组件映射配置              |
| `check_figma_changes`   | 检查设计变更（增量更新）      |
| `save_generated_code`   | 保存生成的代码                |
| `save_asset`            | 保存资源文件                  |
| `get_server_status`     | 获取服务状态                  |

## 使用示例

在 AI 编程工具中：

```
我想把当前 Figma 选中的登录页面生成 React Native 代码
```

AI 会自动：

1. 调用 `get_project_config` 获取配置
2. 调用 `get_code_rules` 获取代码规范
3. 调用 `get_figma_selection` 获取设计数据
4. 分析节点结构，展示组件拆分方案
5. **等待用户确认方案**后再生成代码
6. 调用 `save_generated_code` 保存到项目

## 开发模式

```bash
# 插件开发（热更新）
cd plugin && npm run dev

# MCP Server 开发
cd mcp-server && npm run dev
```

## 技术文档

详细的技术设计请查看 [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md)
