# 代码生成规则（通用默认规则）

本文件定义了从 Figma 设计稿生成 React Native 代码时的**通用默认规则**。  
适用于所有 RN 项目。项目特定的约定请在项目根目录创建 `.figma-rules.md` 覆盖。

> **两层规则机制**：本文件（通用） + 项目级 `.figma-rules.md`（覆盖/补充）。  
> 项目级规则优先级更高，可以覆盖本文件中的任何规则。

---

## 0. 工作流规则（必须遵守）

**禁止直接生成代码。** 在写入任何文件之前，必须先完成以下步骤并等待用户确认：

### 第一步：分析与方案展示

1. **节点结构分析**：概述 Figma 节点树的层级关系和主要区域划分
2. **组件拆分方案**：列出计划拆分的组件，包括：
    - 组件名称与文件路径
    - 组件职责说明
    - 父子关系
3. **资源处理方案**：列出识别到的图片/图标资源及处理方式（导出为文件 or 使用组件库图标）
4. **技术决策说明**：如果涉及布局选择、第三方库使用等决策，一并说明理由

### 第二步：等待用户确认

-   展示完方案后，**明确询问用户是否同意**，等待用户回复
-   用户可能会提出修改意见（如调整组件拆分、更改命名、指定使用某个已有组件等）
-   根据用户反馈调整方案，直到用户确认后再开始生成代码

### 第三步：生成代码

-   用户确认后，按照确认的方案生成代码并写入文件
-   生成完成后，汇总输出的文件列表

---

## 1. 目录结构

### 推荐的页面目录结构

```
src/<pagesDir>/<pageName>/
├── index.tsx                    # 页面入口组件
├── components/                  # 页面私有子组件
│   ├── <ComponentName>/
│   │   └── index.tsx
│   └── <SimpleComponent>.tsx
├── hooks/                       # 页面私有 hooks
│   └── use<HookName>.ts
└── store/                       # 页面私有状态管理（可选）
    └── <pageName>Store.ts
```

> **注意**：`<pagesDir>` 因项目而异（常见：`screens/`、`pages/`、`entries/`），  
> 请在项目级规则（`.figma-rules.md`）中指定实际目录名。

### 组件拆分规则

| 条件                             | 处理                                 |
| -------------------------------- | ------------------------------------ |
| 页面入口                         | 页面目录下的 `index.tsx`             |
| 可复用 UI 片段（列表项、卡片等） | 提取到 `components/<Name>/index.tsx` |
| 列表中的每一项                   | 提取为 `*Card` 或 `*Item` 组件       |
| 弹窗 / Modal                     | 提取为 `*Modal` 组件                 |
| 导航栏                           | 优先复用项目中已有的导航栏组件       |
| 自定义 Hook（逻辑超过 20 行）    | 提取到 `hooks/use<Name>.ts`          |
| 页面 > 200 行                    | 必须拆分子组件                       |

### 共享组件 vs 页面私有组件

| 类型           | 放置位置                 |
| -------------- | ------------------------ |
| 全局共享组件   | `src/components/`        |
| 页面私有组件   | 页面目录下 `components/` |
| 全局共享 hooks | `src/hooks/`             |
| 页面私有 hooks | 页面目录下 `hooks/`      |

---

## 2. 命名规范

### 组件命名

-   组件使用 **PascalCase**: `LoginScreen`, `UserProfileCard`
-   文件名：`index.tsx`（在目录内）或 `ComponentName.tsx`（简单组件）

### 样式命名

-   StyleSheet 中的样式使用 **camelCase**: `containerWrapper`, `titleText`
-   语义化命名，描述用途而非外观: `primaryButton` 而非 `blueButton`

### 资源命名

-   图片资源使用 **kebab-case**: `login-background.png`, `user-avatar.png`
-   图标使用语义命名: `icon-arrow-left.svg`, `icon-close.svg`

### Hooks 命名

-   以 `use` 开头：`useScrollHandler`, `useAuth`, `useShare`

---

## 3. 路径引用

### 路径别名

如果项目配置了路径别名（tsconfig.json 的 `paths`），**必须使用别名**进行跨目录引用。

**规则**:

-   同一页面目录内部可以使用相对路径（`./components/Card`）
-   跨目录引用**必须**使用项目配置的路径别名
-   如果没有配置路径别名，使用标准相对路径

> 项目级规则应明确列出可用的路径别名。

---

## 4. 响应式尺寸

### 通用策略

不同项目有不同的屏幕适配方案，常见有：

| 方案     | 说明                                                |
| -------- | --------------------------------------------------- |
| 直接 dp  | React Native 默认，直接使用数值                     |
| rem 缩放 | `rem = screenWidth / designWidth`，所有尺寸乘以 rem |
| 百分比   | 使用 `Dimensions` 计算百分比                        |

**默认行为**：直接使用 Figma 中的 dp 数值。  
如果项目使用 rem 缩放等方案，请在项目级规则中指定。

### Figma 尺寸转换

-   Figma 中的尺寸值视为设计稿 dp 值
-   直接使用或按项目适配方案转换

---

## 5. 样式规范

### StyleSheet

-   **必须**使用 `StyleSheet.create()` 定义样式
-   **禁止**内联样式（`style={{ ... }}`），除非是动态值
-   动态样式使用数组形式：`style={[styles.base, { opacity: value }]}`
-   复杂组件的样式可以分离到 `styles.ts` 文件

### StyleSheet 定义位置

推荐放在组件定义**之前**（常量之后），也可放在文件底部，以项目级规则为准。

### 颜色

-   使用项目中定义的颜色常量 / 设计 token（如有）
-   颜色格式: `#RRGGBB` 或 `rgba(r, g, b, a)`
-   避免硬编码魔法颜色值，优先使用已有常量

### 阴影

```tsx
// iOS 阴影
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.1,
shadowRadius: 4,
// Android 阴影
elevation: 3,
```

---

## 6. 布局偏好

### Flexbox 优先

-   始终优先使用 Flexbox 布局
-   避免绝对定位，除非设计中明确需要层叠效果
-   使用 margin 或 `gap`（RN 0.71+）实现元素间距

### 对齐方式

-   明确使用 `justifyContent` 和 `alignItems`
-   不依赖默认值，显式声明对齐方式

### Figma 绝对定位转换

-   Figma 中的绝对定位布局应**尽量转换为 Flexbox**
-   仅浮动元素（如悬浮按钮、覆盖层）使用 `position: 'absolute'`

---

## 7. 组件结构模板

### 页面入口组件

```tsx
/**
 * PageName 页面
 * 简要说明页面功能
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 页面私有组件（相对路径）
import CardItem from './components/CardItem';

// ============================================================
// 样式定义
// ============================================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
});

// ============================================================
// 主组件
// ============================================================
interface PageNameProps {
    navigation?: any;
}

export default function PageName({
    navigation,
}: PageNameProps): React.ReactElement {
    return <View style={styles.container}>{/* 页面内容 */}</View>;
}
```

### 子组件

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    container: {},
});

interface CardItemProps {
    title: string;
    onPress?: () => void;
}

const CardItem: React.FC<CardItemProps> = ({ title, onPress }) => {
    return (
        <View style={styles.container}>
            <Text>{title}</Text>
        </View>
    );
};

export default CardItem;
```

---

## 8. 导入顺序

```tsx
// 1. React 核心
import React, { useState, useEffect, useCallback, useMemo } from 'react';

// 2. React Native 组件
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';

// 3. 第三方库
import {} from /* ... */ 'some-library';

// 4. 项目共享模块（路径别名 或 相对路径）
import SomeComponent from '@components/SomeComponent';

// 5. 类型定义
import type { SomeType } from '@/types';

// 6. 页面私有模块（相对路径）
import CardItem from './components/CardItem';
```

---

## 9. React Native 特定规则

### 文字处理

-   所有文字**必须**包裹在 `<Text>` 组件中
-   文字样式通过 `StyleSheet` 定义

### 图片处理

-   本地图片使用 `require()` 引用
-   网络图片使用 `{ uri: url }` 格式
-   设置明确的 `width` 和 `height`
-   使用合适的 `resizeMode`

### 触摸交互

-   可点击元素使用 `TouchableOpacity` 或 `Pressable`
-   提供 `activeOpacity={0.7}` 反馈
-   避免嵌套可点击元素

### 列表选择

| 场景                      | 推荐组件               |
| ------------------------- | ---------------------- |
| 长列表（同类型数据）      | `FlatList`             |
| 分组列表                  | `SectionList`          |
| 短列表（< 20 项静态内容） | `ScrollView` + `map()` |

---

## 10. 不支持的 Figma 特性处理

| Figma 特性   | 处理方式                                   |
| ------------ | ------------------------------------------ |
| 线性渐变     | 使用 `react-native-linear-gradient`        |
| 模糊效果     | 使用 `@react-native-community/blur` 或跳过 |
| 内阴影       | 跳过或使用图片替代                         |
| 复杂路径     | 导出为 SVG 使用 `react-native-svg`         |
| 绝对定位布局 | 转换为 Flexbox 布局                        |

---

## 11. 代码质量

### 类型安全

-   所有组件使用 TypeScript
-   定义明确的 Props 接口
-   避免使用 `any` 类型
-   避免使用 `@ts-ignore` 或 `@ts-expect-error`

### 性能优化

-   使用 `useCallback` 包裹传给子组件的回调函数
-   使用 `useMemo` 缓存昂贵计算和列表渲染数据
-   列表项组件推荐使用 `React.memo` 包裹

### 注释

-   文件顶部使用 JSDoc 注释说明组件功能
-   只在复杂逻辑处添加注释
-   不为显而易见的代码添加注释

---

## 12. 生成代码检查清单

生成代码后，确认以下事项：

-   [ ] **文件拆分**：页面 > 200 行时，列表项/卡片/弹窗是否提取为子组件？
-   [ ] **StyleSheet**：样式是否使用 `StyleSheet.create()` 而非内联？
-   [ ] **路径引用**：跨目录引用是否使用项目配置的路径别名？
-   [ ] **尺寸适配**：是否按项目级规则的适配方案处理尺寸？
-   [ ] **导入顺序**：是否按规定顺序排列？
-   [ ] **类型安全**：Props 是否定义了 interface？是否避免了 `any`？
-   [ ] **Hooks**：传给子组件的回调是否用 `useCallback` 包裹？
-   [ ] **项目级规则**：是否遵守了 `.figma-rules.md` 中的额外约定？
