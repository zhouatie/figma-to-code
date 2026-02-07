# Figma to Code

## 背景

作为资深前端开发工程师，不应该把大量时间浪费在画非常简单的页面。

## 功能介绍

本项目是一个 Figma 插件 + MCP Server 解决方案，让 Claude Code 能够实时获取 Figma 设计稿数据并生成代码。

**核心优势**：使用 Figma Plugin API 而非 REST API，绑过 Figma 普通账号每月 6 次的 API 调用限制。

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
├── figma-to-code.config.json    # 项目配置
├── code-rules.md                # 代码生成规则
├── component-map.json           # 组件映射配置
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

### 4. 配置 Claude Code

在 `~/.claude/settings.json` 中添加 MCP Server 配置：

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

### 5. 启动使用

```bash
# 启动 MCP Server（会同时启动 WebSocket 服务）
cd mcp-server && npm start
```

然后：

1. 在 Figma 中打开插件
2. 点击"连接服务器"
3. 选中 Figma 图层
4. 在 Claude Code 中请求生成代码

## 配置说明

### figma-to-code.config.json

```json
{
    "framework": "react-native", // 目标框架
    "styling": {
        "type": "stylesheet", // 样式方案
        "unit": "dp" // 尺寸单位
    },
    "output": {
        "componentDir": "./src/components",
        "assetDir": "./src/assets"
    },
    "rules": "./code-rules.md", // 代码规则文件
    "componentMap": "./component-map.json" // 组件映射
}
```

### code-rules.md

定义代码生成的规范，包括：

-   命名规范
-   布局偏好
-   组件拆分策略
-   框架特定规则

### component-map.json

定义 Figma 组件到项目组件的映射关系。

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

在 Claude Code 中：

```
我想把当前 Figma 选中的登录页面生成 React Native 代码
```

Claude 会自动：

1. 调用 `get_project_config` 获取配置
2. 调用 `get_code_rules` 获取代码规范
3. 调用 `get_figma_selection` 获取设计数据
4. 根据配置和规则生成代码
5. 调用 `save_generated_code` 保存到项目

## 开发模式

```bash
# 插件开发（热更新）
cd plugin && npm run dev

# MCP Server 开发
cd mcp-server && npm run dev
```

## 技术文档

详细的技术设计请查看 [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md)
