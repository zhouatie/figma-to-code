# 代码生成规则（通用基础规则）

本文件定义了从 Figma 设计稿生成代码时的**框架无关通用规则**。  
适用于所有前端框架（React Native、React、Flutter 等）。

> **三层规则机制**：
>
> 1. 本文件（通用基础）
> 2. 框架规则（`framework-rules/<framework>.md`）
> 3. 项目级规则（`.aiwork/figma-rules.md`）
>
> 优先级递增，后者覆盖前者。

---

## 0. 工作流规则（必须遵守）

**禁止直接生成代码。** 在写入任何文件之前，必须先完成以下步骤并等待用户确认：

### 第一步：分析与方案展示

1. **节点结构分析**：概述 Figma 节点树的层级关系和主要区域划分
2. **组件拆分方案**：列出计划拆分的组件，包括：
    - 组件名称与文件路径
    - 组件职责说明
    - 父子关系
3. **资源处理方案**：列出识别到的图片/图标资源及处理方式
4. **技术决策说明**：如果涉及布局选择、第三方库使用等决策，一并说明理由

### 第二步：等待用户确认

-   展示完方案后，**明确询问用户是否同意**，等待用户回复
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

> `<pagesDir>` 因项目而异（`screens/`、`pages/`、`entries/`、`lib/` 等），  
> 请在项目级规则中指定实际目录名。

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

-   样式键名使用 **camelCase**: `containerWrapper`, `titleText`
-   语义化命名，描述用途而非外观: `primaryButton` 而非 `blueButton`

### 资源命名

-   图片资源使用 **kebab-case**: `login-background.png`, `user-avatar.png`
-   图标使用语义命名: `icon-arrow-left.svg`, `icon-close.svg`

### Hooks 命名

-   以 `use` 开头：`useScrollHandler`, `useAuth`, `useShare`

---

## 3. 路径引用

### 路径别名

如果项目配置了路径别名，**必须使用别名**进行跨目录引用。

**规则**:

-   同一页面目录内部可以使用相对路径（`./components/Card`）
-   跨目录引用**必须**使用项目配置的路径别名
-   如果没有配置路径别名，使用标准相对路径

> 项目级规则应明确列出可用的路径别名。

---

## 4. 响应式尺寸

### 通用策略

不同项目有不同的屏幕适配方案，常见有：

| 方案           | 说明                              |
| -------------- | --------------------------------- |
| 直接使用设计值 | 框架默认单位（dp/px/pt）          |
| 缩放因子       | `rem = screenWidth / designWidth` |
| 百分比         | 根据屏幕尺寸计算百分比            |
| 响应式断点     | 根据屏幕宽度应用不同样式          |

**默认行为**：直接使用 Figma 中的尺寸数值。  
如果项目有特定适配方案，请在项目级规则中指定。

---

## 5. 样式规范

### 颜色

-   使用项目中定义的颜色常量 / 设计 token（如有）
-   颜色格式: `#RRGGBB` 或 `rgba(r, g, b, a)`
-   避免硬编码魔法颜色值，优先使用已有常量

### 样式组织

-   样式定义集中管理，避免分散
-   复杂组件的样式可以分离到独立文件

> 具体样式 API（StyleSheet / CSS / styled-components 等）见框架规则。

---

## 6. 布局偏好

### Flexbox 优先

-   始终优先使用 Flexbox 布局
-   避免绝对定位，除非设计中明确需要层叠效果
-   明确使用 `justifyContent` 和 `alignItems`，不依赖默认值

### Figma 绝对定位转换

-   Figma 中的绝对定位布局应**尽量转换为 Flexbox**
-   仅浮动元素（悬浮按钮、覆盖层）使用绝对定位

---

## 7. 代码质量

### 类型安全

-   所有组件使用 TypeScript
-   定义明确的 Props 接口
-   避免使用 `any` 类型
-   避免使用 `@ts-ignore` 或 `@ts-expect-error`

### 性能优化

-   使用 `useCallback` 包裹传给子组件的回调函数
-   使用 `useMemo` 缓存昂贵计算和列表渲染数据
-   列表项组件推荐使用 `memo` 包裹

### 注释

-   文件顶部使用 JSDoc 注释说明组件功能
-   只在复杂逻辑处添加注释
-   不为显而易见的代码添加注释

---

## 8. 生成代码检查清单

生成代码后，确认以下事项：

-   [ ] **文件拆分**：页面 > 200 行时，列表项/卡片/弹窗是否提取为子组件？
-   [ ] **样式组织**：样式是否集中定义而非内联？
-   [ ] **路径引用**：跨目录引用是否使用项目配置的路径别名？
-   [ ] **尺寸适配**：是否按项目级规则的适配方案处理尺寸？
-   [ ] **类型安全**：Props 是否定义了 interface？是否避免了 `any`？
-   [ ] **Hooks**：传给子组件的回调是否用 `useCallback` 包裹？
-   [ ] **框架规则**：是否遵守了对应框架的特定规则？
-   [ ] **项目级规则**：是否遵守了 `.aiwork/figma-rules.md` 中的额外约定？

---

## 9. 交互代码生成规则

当需要生成带交互逻辑的代码时（不仅仅是静态 UI），遵循以下规则：

### 前置条件

1. **必须先读取技术方案**：使用 `get_tech_design` 获取技术方案
2. **必须先读取交互文档**：使用 `get_interaction_spec` 获取交互说明（如有）
3. **必须先读取 API 文档**：使用 `get_api_spec` 获取接口定义（如有）

### 状态管理规范

根据项目配置的 `stateManagement` 字段选择状态管理方案：

#### Zustand（推荐）

```typescript
// store/<pageName>Store.ts
import { create } from 'zustand';

interface PageState {
    // 状态字段
    isLoading: boolean;
    data: DataType | null;
    error: string | null;

    // 操作方法
    fetchData: () => Promise<void>;
    reset: () => void;
}

export const usePageStore = create<PageState>((set, get) => ({
    isLoading: false,
    data: null,
    error: null,

    fetchData: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await api.getData();
            set({ data, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    reset: () => set({ isLoading: false, data: null, error: null }),
}));
```

### 网络请求规范

根据项目配置的 `networkLib` 字段选择网络库：

#### Axios

```typescript
// services/api.ts
import axios from 'axios';

const instance = axios.create({
    baseURL: '/api',
    timeout: 10000,
});

export const userApi = {
    login: (credentials: Credentials) =>
        instance.post<LoginResponse>('/auth/login', credentials),

    getProfile: () => instance.get<UserProfile>('/user/profile'),
};
```

### 导航规范

根据项目配置的 `navigation` 字段选择导航方案：

#### React Navigation

```typescript
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
    Home: undefined;
    Detail: { id: string };
};

const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

// 导航操作
navigation.navigate('Detail', { id: '123' });
navigation.goBack();
```

### 交互代码检查清单

生成交互代码后，额外确认：

-   [ ] **状态管理**：是否使用了项目配置的状态管理方案？
-   [ ] **API 调用**：是否遵循了 API 文档定义的接口规范？
-   [ ] **错误处理**：是否处理了加载状态、错误状态？
-   [ ] **导航逻辑**：是否使用了项目配置的导航方案？
-   [ ] **类型定义**：API 响应类型是否与 API 文档一致？
