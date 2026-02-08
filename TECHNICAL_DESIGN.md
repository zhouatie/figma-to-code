# Figma to Code 技术设计文档

## 概述

本项目实现一个 Figma 插件 + MCP Server 的解决方案，让支持 MCP 协议的 AI 编程工具（如 Claude Code、OpenCode 等）能够实时获取 Figma 设计稿数据并生成代码。

## 系统架构

```
┌────────────────────────────────────────────────────────────────────┐
│                         Figma 客户端                               │
│  ┌─────────────────┐        ┌─────────────────────────────────┐   │
│  │  Plugin Sandbox │        │         Plugin UI (iframe)      │   │
│  │    code.ts      │◀──────▶│           ui.html               │   │
│  │                 │ post   │  ┌───────────────────────────┐  │   │
│  │ - 监听选中变化   │ Message│  │ WebSocket Client          │  │   │
│  │ - 提取节点数据   │        │  │ ws://localhost:3001       │  │   │
│  │ - 导出图片资源   │        │  └───────────┬───────────────┘  │   │
│  └─────────────────┘        └───────────────┼─────────────────┘   │
└─────────────────────────────────────────────┼─────────────────────┘
                                              │ WebSocket
                                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Local MCP Server (Node.js)                      │
│  ┌─────────────────┐        ┌─────────────────────────────────┐   │
│  │  WebSocket Server│        │         MCP Protocol            │   │
│  │  :3001          │───────▶│  - get_figma_selection          │   │
│  │                 │ 缓存    │  - get_project_config           │   │
│  │ 接收 Figma 数据  │ 数据    │  - check_figma_changes          │   │
│  └─────────────────┘        └───────────────┬─────────────────┘   │
└─────────────────────────────────────────────┼─────────────────────┘
                                              │ stdio
                                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                         Claude Code / OpenCode                     │
│  调用 MCP 工具获取 Figma 数据 → 分析布局 → 确认方案 → 生成代码     │
└────────────────────────────────────────────────────────────────────┘
```

## 项目结构

```
figma-plugin/
├── plugin/                      # Figma 插件
│   ├── manifest.json            # 插件配置
│   ├── src/
│   │   ├── code.ts              # Sandbox 主逻辑
│   │   ├── ui.tsx               # UI 界面（React）
│   │   ├── extractor.ts         # 节点数据提取器
│   │   └── types.ts             # 类型定义
│   ├── package.json
│   └── tsconfig.json
│
├── mcp-server/                  # MCP 服务端
│   ├── src/
│   │   ├── index.ts             # MCP 入口
│   │   ├── websocket-server.ts  # WebSocket 服务
│   │   ├── figma-tools.ts       # MCP 工具定义
│   │   ├── data-store.ts        # 数据缓存
│   │   └── types.ts             # 共享类型定义
│   ├── package.json
│   └── tsconfig.json
│
├── figma-to-code.config.json    # 项目配置
├── code-rules.md                # 代码生成规则（通用）
├── component-map.json           # 组件映射配置
├── .gitignore                   # Git 忽略规则
├── TECHNICAL_DESIGN.md          # 本文档
└── README.md
```

---

## 1. Figma 节点映射逻辑

### 节点类型识别

Figma 中的节点有几种来源：

| 类型               | 说明                                | 识别方式                   |
| ------------------ | ----------------------------------- | -------------------------- |
| Component Instance | 引用了组件库的实例                  | 有 `mainComponent` 属性    |
| 普通 Frame/Group   | 设计师手画的                        | 通过命名规范或结构特征识别 |
| 原子节点           | TEXT, RECTANGLE, ELLIPSE, VECTOR 等 | 直接映射为基础元素         |

### 识别策略（优先级从高到低）

```typescript
function identifyComponent(node: SceneNode): ComponentMatch {
    // 策略1: Component Instance - 最可靠
    if (node.type === 'INSTANCE') {
        const componentName = node.mainComponent?.name;
        const variantProps = node.variantProperties;
        return {
            matchType: 'component-instance',
            figmaName: componentName,
            variants: variantProps,
            confidence: 1.0,
        };
    }

    // 策略2: 命名约定匹配
    const nameMatch = matchByNamingConvention(node.name);
    if (nameMatch) {
        return {
            matchType: 'naming-convention',
            figmaName: node.name,
            inferredComponent: nameMatch,
            confidence: 0.9,
        };
    }

    // 策略3: 结构特征识别（启发式）
    const structureMatch = matchByStructure(node);
    if (structureMatch) {
        return {
            matchType: 'structure-heuristic',
            figmaName: node.name,
            inferredComponent: structureMatch.component,
            confidence: structureMatch.confidence,
        };
    }

    // 策略4: 降级为基础元素
    return {
        matchType: 'primitive',
        figmaName: node.name,
        primitiveType: node.type,
        confidence: 1.0,
    };
}
```

### 结构特征识别示例

```typescript
function matchByStructure(node: SceneNode): StructureMatch | null {
    // 识别按钮: 一个容器 + 可选图标 + 文字
    if (isFrameNode(node)) {
        const children = node.children;
        const hasText = children.some((c) => c.type === 'TEXT');
        const hasFill = node.fills?.length > 0;
        const hasRadius = node.cornerRadius > 0;
        const isSmall = node.width < 300 && node.height < 80;

        if (hasText && hasFill && hasRadius && isSmall) {
            return { component: 'Button', confidence: 0.7 };
        }
    }

    // 识别输入框
    if (isFrameNode(node) && node.strokes?.length > 0) {
        const textChild = node.children.find((c) => c.type === 'TEXT');
        if (textChild && textChild.opacity < 1) {
            return { component: 'Input', confidence: 0.6 };
        }
    }

    // 识别列表
    if (isFrameNode(node) && node.children.length >= 3) {
        if (areChildrenSimilar(node.children)) {
            return { component: 'List', confidence: 0.7 };
        }
    }

    return null;
}
```

### 组件映射配置

```json
{
    "rules": [
        {
            "match": {
                "type": "instance",
                "componentName": "Button/*"
            },
            "map": {
                "component": "MyButton",
                "import": "@/components/MyButton",
                "propsMapping": {
                    "variant": "$variantProps.variant",
                    "size": "$variantProps.size",
                    "children": "$findChild(TEXT).characters"
                }
            }
        },
        {
            "match": {
                "type": "name-pattern",
                "pattern": "^icon[-/](.+)$"
            },
            "map": {
                "component": "Icon",
                "import": "@/components/Icon",
                "propsMapping": {
                    "name": "$match[1]"
                }
            }
        }
    ],
    "fallback": {
        "FRAME": "View",
        "TEXT": "Text",
        "RECTANGLE": "View",
        "ELLIPSE": "View",
        "VECTOR": "Svg",
        "IMAGE": "Image"
    }
}
```

---

## 2. 图片/图标资源处理

### 资源分类

| 类型         | 说明           | 处理方式                    |
| ------------ | -------------- | --------------------------- |
| 位图 (Image) | 照片、复杂图形 | 导出 PNG/JPG/WebP           |
| 矢量图标     | 简单图标       | 导出 SVG 或映射到 Icon 组件 |
| 复杂矢量图   | 插画等         | 导出 SVG 文件               |

### 导出逻辑

```typescript
async function exportAssets(node: SceneNode): Promise<AssetExport[]> {
    const assets: AssetExport[] = [];

    await traverseNode(node, async (child) => {
        // 1. 图片填充 - 导出为位图
        if ('fills' in child) {
            const imageFills = child.fills.filter((f) => f.type === 'IMAGE');
            for (const fill of imageFills) {
                const imageBytes = await child.exportAsync({
                    format: 'PNG',
                    constraint: { type: 'SCALE', value: 2 },
                });

                assets.push({
                    type: 'image',
                    nodeId: child.id,
                    nodeName: sanitizeFileName(child.name),
                    format: 'png',
                    data: base64Encode(imageBytes),
                    usage: { width: child.width, height: child.height },
                });
            }
        }

        // 2. 矢量节点 - 判断是否为图标
        if (child.type === 'VECTOR' || child.type === 'BOOLEAN_OPERATION') {
            const isIcon = isLikelyIcon(child);

            if (isIcon) {
                const svgBytes = await child.exportAsync({ format: 'SVG' });
                assets.push({
                    type: 'icon',
                    nodeId: child.id,
                    nodeName: sanitizeFileName(child.name),
                    format: 'svg',
                    data: uint8ToString(svgBytes),
                    inline: true,
                });
            }
        }

        // 3. 显式导出标记
        if (
            child.name.startsWith('export/') ||
            child.exportSettings?.length > 0
        ) {
            const bytes = await child.exportAsync({
                format: 'PNG',
                constraint: { type: 'SCALE', value: 2 },
            });
            assets.push({
                type: 'image',
                nodeId: child.id,
                nodeName: sanitizeFileName(child.name.replace('export/', '')),
                format: 'png',
                data: base64Encode(bytes),
            });
        }
    });

    return assets;
}

function isLikelyIcon(node: SceneNode): boolean {
    const maxIconSize = 64;
    const isSmall = node.width <= maxIconSize && node.height <= maxIconSize;
    const nameHint = /icon|ico|arrow|chevron|check|close|menu/i.test(node.name);
    return isSmall || nameHint;
}
```

### 资源配置

```json
{
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
    }
}
```

---

## 3. 样式转换规则

### Figma → React Native StyleSheet 映射

#### 布局转换

| Figma 属性                        | React Native 属性          |
| --------------------------------- | -------------------------- |
| `layoutMode: "HORIZONTAL"`        | `flexDirection: "row"`     |
| `layoutMode: "VERTICAL"`          | `flexDirection: "column"`  |
| `primaryAxisAlignItems: "CENTER"` | `justifyContent: "center"` |
| `counterAxisAlignItems: "CENTER"` | `alignItems: "center"`     |
| `itemSpacing`                     | `gap`                      |

#### 尺寸转换

| Figma 属性                        | React Native 属性 |
| --------------------------------- | ----------------- |
| `layoutSizingHorizontal: "FIXED"` | `width: <value>`  |
| `layoutSizingHorizontal: "FILL"`  | `flex: 1`         |
| `layoutSizingHorizontal: "HUG"`   | 不设置 width      |

#### 样式转换器

```typescript
const styleConverters = {
    layout: (node) => {
        const styles: any = {};

        if (node.layoutMode === 'HORIZONTAL') {
            styles.flexDirection = 'row';
        } else if (node.layoutMode === 'VERTICAL') {
            styles.flexDirection = 'column';
        }

        const primaryAxisMap = {
            MIN: 'flex-start',
            CENTER: 'center',
            MAX: 'flex-end',
            SPACE_BETWEEN: 'space-between',
        };
        styles.justifyContent = primaryAxisMap[node.primaryAxisAlignItems];

        const counterAxisMap = {
            MIN: 'flex-start',
            CENTER: 'center',
            MAX: 'flex-end',
            STRETCH: 'stretch',
        };
        styles.alignItems = counterAxisMap[node.counterAxisAlignItems];

        if (node.itemSpacing) {
            styles.gap = node.itemSpacing;
        }

        return styles;
    },

    fills: (node) => {
        const styles: any = {};
        const fill = node.fills?.[0];

        if (!fill || !fill.visible) return styles;

        switch (fill.type) {
            case 'SOLID':
                styles.backgroundColor = rgbaToString(fill.color, fill.opacity);
                break;
            case 'GRADIENT_LINEAR':
                styles._gradient = {
                    type: 'linear',
                    colors: fill.gradientStops.map((s) =>
                        rgbaToString(s.color),
                    ),
                    start: fill.gradientHandlePositions[0],
                    end: fill.gradientHandlePositions[1],
                };
                break;
        }

        return styles;
    },

    strokes: (node) => {
        const styles: any = {};
        const stroke = node.strokes?.[0];

        if (!stroke || !stroke.visible) return styles;

        styles.borderWidth = node.strokeWeight;
        styles.borderColor = rgbaToString(stroke.color, stroke.opacity);

        return styles;
    },

    cornerRadius: (node) => {
        const styles: any = {};

        if (typeof node.cornerRadius === 'number') {
            styles.borderRadius = node.cornerRadius;
        } else {
            styles.borderTopLeftRadius = node.topLeftRadius;
            styles.borderTopRightRadius = node.topRightRadius;
            styles.borderBottomRightRadius = node.bottomRightRadius;
            styles.borderBottomLeftRadius = node.bottomLeftRadius;
        }

        return styles;
    },

    effects: (node) => {
        const styles: any = {};
        const shadow = node.effects?.find(
            (e) => e.type === 'DROP_SHADOW' && e.visible,
        );

        if (shadow) {
            styles.shadowColor = rgbaToString(shadow.color);
            styles.shadowOffset = {
                width: shadow.offset.x,
                height: shadow.offset.y,
            };
            styles.shadowOpacity = shadow.color.a;
            styles.shadowRadius = shadow.radius;
            styles.elevation = Math.round(shadow.radius / 2);
        }

        return styles;
    },

    text: (node) => {
        if (node.type !== 'TEXT') return {};

        return {
            fontSize: node.fontSize,
            color: rgbaToString(node.fills?.[0]?.color),
            fontWeight: fontWeightMap[node.fontName?.style] || 'normal',
            textAlign: node.textAlignHorizontal?.toLowerCase(),
            lineHeight: node.lineHeight?.value || node.fontSize * 1.2,
            letterSpacing: node.letterSpacing?.value || 0,
            fontFamily: node.fontName?.family,
        };
    },

    padding: (node) => {
        const styles: any = {};

        if (
            node.paddingTop === node.paddingBottom &&
            node.paddingLeft === node.paddingRight &&
            node.paddingTop === node.paddingLeft
        ) {
            styles.padding = node.paddingTop;
        } else {
            styles.paddingTop = node.paddingTop;
            styles.paddingRight = node.paddingRight;
            styles.paddingBottom = node.paddingBottom;
            styles.paddingLeft = node.paddingLeft;
        }

        return styles;
    },
};
```

### 不支持属性的处理

| Figma 效果 | 解决方案                       |
| ---------- | ------------------------------ |
| 线性渐变   | `react-native-linear-gradient` |
| 模糊效果   | `@react-native-community/blur` |
| 内阴影     | 使用图片或跳过                 |

---

## 5. 增量更新

### 版本追踪机制

基于节点 ID 的版本追踪：

1. 首次生成时，记录每个节点 ID 与生成代码的映射关系
2. 记录节点的 "内容签名" (hash)
3. 下次同步时，对比签名，只处理变化的节点
4. 生成 diff，智能合并到现有代码

### 映射记录文件 `.figma-sync.json`

```json
{
    "lastSync": "2024-01-15T10:30:00Z",
    "fileKey": "abc123",
    "nodes": {
        "1:234": {
            "name": "LoginScreen",
            "hash": "a1b2c3d4e5f6",
            "generatedFile": "src/screens/LoginScreen.tsx",
            "generatedStyles": "src/screens/LoginScreen.styles.ts",
            "assets": ["src/assets/images/login-bg.png"],
            "children": ["1:235", "1:236", "1:240"]
        },
        "1:235": {
            "name": "Header",
            "hash": "f6e5d4c3b2a1",
            "generatedFile": "src/components/Header.tsx",
            "inlineIn": "src/screens/LoginScreen.tsx",
            "lineRange": [15, 45]
        }
    }
}
```

### 内容签名算法

```typescript
function computeNodeHash(node: FigmaNodeData): string {
    const significantProps = {
        type: node.type,
        width: node.width,
        height: node.height,
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

    return md5(JSON.stringify(significantProps));
}
```

### 变更检测

```typescript
interface NodeChange {
    nodeId: string;
    changeType: 'added' | 'modified' | 'deleted' | 'moved';
    oldHash?: string;
    newHash?: string;
    affectedFiles: string[];
}

function detectChanges(
    oldMapping: SyncMapping,
    newNodes: FigmaNodeData[],
): NodeChange[] {
    const changes: NodeChange[] = [];
    const newNodesMap = new Map(newNodes.map((n) => [n.id, n]));

    // 检测修改和删除
    for (const [nodeId, oldInfo] of Object.entries(oldMapping.nodes)) {
        const newNode = newNodesMap.get(nodeId);

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
            newNodesMap.delete(nodeId);
        }
    }

    // 检测新增
    for (const [nodeId, node] of newNodesMap) {
        changes.push({
            nodeId,
            changeType: 'added',
            newHash: computeNodeHash(node),
            affectedFiles: [],
        });
    }

    return changes;
}
```

### 代码合并策略

#### 方案1: 分区保护（推荐）

```typescript
// 生成的代码中标记区域
const generatedCode = `
// ==========  AUTO-GENERATED - DO NOT EDIT BELOW  ==========
const styles = StyleSheet.create({
  container: { ... },
});
// ==========  AUTO-GENERATED - DO NOT EDIT ABOVE  ==========

// ==========  CUSTOM CODE - SAFE TO EDIT  ==========
export const customLogic = () => {
  // 用户自定义逻辑
};
// ==========  END CUSTOM CODE  ==========
`;
```

#### 方案2: 样式与组件分离

-   `LoginScreen.styles.ts` ← 可以完全覆盖
-   `LoginScreen.tsx` ← 只更新 JSX 结构，保留事件处理逻辑

---

## 配置文件

### 项目配置 `figma-to-code.config.json`

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
    "projectRules": ".figma-rules.md",
    "componentMap": "./component-map.json"
}
```

### 代码规则 `code-rules.md`

采用**两层规则机制**：

-   **通用规则**（`code-rules.md`）：适用于所有项目的默认规范
-   **项目级规则**（`.figma-rules.md`）：放在目标项目根目录，可覆盖/补充通用规则，优先级更高

规则内容包括：

-   **工作流规则**：生成代码前必须先展示方案并等待用户确认
-   命名规范
-   布局偏好
-   组件拆分策略
-   框架特定规则

---

## MCP 工具列表

| 工具名                  | 说明                                   |
| ----------------------- | -------------------------------------- |
| `get_figma_selection`   | 获取当前 Figma 选中的节点完整数据      |
| `get_project_config`    | 读取项目的代码生成配置                 |
| `get_code_rules`        | 读取用户定义的代码规则（支持两层规则） |
| `get_component_mapping` | 获取组件映射关系                       |
| `check_figma_changes`   | 检查设计变更                           |
| `save_generated_code`   | 保存生成的代码并更新同步记录           |
| `save_asset`            | 保存导出的资源文件（图片、图标等）     |
| `get_server_status`     | 获取服务状态和连接信息                 |

---

## 使用流程

1. 配置 AI 编程工具（Claude Code / OpenCode），MCP Server 由工具自动启动
2. 在 Figma 中打开插件，点击"连接服务器"
3. 选中需要转换的节点（自动同步到 MCP Server）
4. 在 AI 编程工具中请求生成代码
5. AI 调用 MCP 工具获取数据，分析节点结构
6. AI 展示组件拆分方案，**等待用户确认**
7. 用户确认后，AI 生成代码并保存到项目
