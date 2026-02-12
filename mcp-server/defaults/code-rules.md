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
5. **用户标注处理**：检查 `meta.annotations` 汇总列表，逐一列出所有用户标注，并说明将如何落实每条标注要求

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

### 尺寸精确度

-   Figma 中的数值必须**精确还原**，不得四舍五入或取近似值
-   固定尺寸元素（按钮、图标、卡片等）使用精确像素值，**不使用百分比**
-   间距（margin、padding、gap）严格按 Figma 节点的数值或坐标差值计算
-   当多个同级元素有固定间距时，优先使用 `gap` 属性

### 混合字体 / 字号文本

当一个视觉文本区域包含多种字体或字号时（如数字用 Outfit，汉字用 PingFang）：

-   拆分为**多个并排的 Text 组件**，分别设置 `fontFamily` 和 `fontSize`
-   外层用 `View` + `flexDirection: 'row'` + `alignItems: 'baseline'` 包裹
-   不要尝试在单个 Text 中用嵌套 Text 处理不同字体族（跨字体族时表现不一致）

---

## 5. 样式规范

### 颜色

-   使用项目中定义的颜色常量 / 设计 token（如有）
-   颜色格式: `#RRGGBB` 或 `rgba(r, g, b, a)`
-   避免硬编码魔法颜色值，优先使用已有常量

### 样式组织

-   样式定义集中管理，避免分散
-   复杂组件的样式可以分离到独立文件

### 图片 vs 样式代码还原决策

当遇到视觉元素时，按以下优先级判断实现方式：

| 场景 | 实现方式 | 说明 |
| --- | --- | --- |
| 用户提供了 CDN 地址 | **必须使用该 CDN 图片** | 禁止用样式代码模拟已有的图片资源 |
| 节点包含复杂渐变、纹理、光效、手绘元素 | 使用图片资源 | 样式代码无法精确还原的视觉效果 |
| 纯色/单色渐变背景、圆角矩形、简单边框 | 使用样式代码 | 标准样式属性可精确还原的 |

**禁止行为**：

-   禁止用样式代码（渐变、圆角、阴影组合等）去模拟已有的图片资源
-   禁止因为「觉得可以用样式代码实现」而忽略用户提供的图片地址

> 具体实现方式（伪元素 / 额外 View / Overlay 组件等）见框架规则。

---

## 5.5 Figma 节点数据读取规则（必须遵守）

正确理解 Figma 节点字段是生成高质量代码的前提。以下规则优先级最高。

### TEXT 节点

-   **必须使用 `characters` 字段**获取文本内容，**禁止使用 `name` 字段**
-   `name` 是设计师在图层面板中的命名标签（如 "标题"、"price"），与实际显示文本无关
-   `characters` 才是用户在界面上看到的真实文本
-   示例：`name="签到"` 但 `characters="已连续签到2天"`，**必须使用后者**

### BOOLEAN_OPERATION 节点

-   **一律作为图片资源处理**（CDN Image 或 ImageBackground）
-   **禁止尝试用代码还原** BOOLEAN_OPERATION 的路径运算（Subtract、Union、Intersect 等）
-   常见场景：邮票锯齿边缘、异形卡片、Logo 组合图形、穿孔效果

### INSTANCE 节点

-   检查 `componentProperties` 和 `variantProperties` 字段
-   INSTANCE 通常对应**动态数据**（来自 API），不应生成硬编码静态内容
-   多个相同 INSTANCE 出现 → 数据驱动的列表渲染（`array.map()`）
-   `variantProperties` 中的属性名/值可作为数据模型字段的参考

### layoutMode 字段

| layoutMode 值  | 含义                       | 处理方式                                                           |
| -------------- | -------------------------- | ------------------------------------------------------------------ |
| `HORIZONTAL`   | 水平 Auto Layout           | 直接映射为 `flexDirection: 'row'`                                  |
| `VERTICAL`     | 垂直 Auto Layout           | 直接映射为 `flexDirection: 'column'`                               |
| `NONE`         | 无 Auto Layout（绝对定位） | **根据子节点 Y 坐标分组推断语义布局**，尽量转为 Flexbox（见下方） |

### layoutMode=NONE 的推断策略

当父节点 `layoutMode=NONE` 时，子节点使用绝对坐标定位。按以下步骤推断语义布局：

1. 按子节点 **Y 坐标排序**
2. Y 坐标接近的节点归为**同一行**（row），容差范围取较小节点高度的 50%
3. 每行内按 **X 坐标排序**
4. 整体按行从上到下排列（column）
5. 存在坐标大面积重叠的节点视为**层叠关系**，使用绝对定位

---

## 6. 布局偏好

### Flexbox 优先

-   始终优先使用 Flexbox 布局
-   避免绝对定位，除非设计中明确需要层叠效果
-   明确使用 `justifyContent` 和 `alignItems`，不依赖默认值

### Figma 绝对定位转换

-   Figma 中的绝对定位布局应**尽量转换为 Flexbox**
-   仅浮动元素（悬浮按钮、覆盖层）使用绝对定位

### 层叠布局处理

同一父节点下的子节点如果存在坐标重叠（即多个节点在 x/y 上互相覆盖），说明是层叠布局。

**判断层叠关系**：

-   节点在 children 数组中的顺序 = 层叠顺序（后面的在上面）
-   对比节点的 x、y、width、height，如果存在交集则为层叠

### 弹窗 / 底部弹出层识别

当 Figma 节点满足以下特征时，识别为**底部弹出层**（Bottom Sheet / Modal）：

-   根 FRAME 尺寸 = 全屏（如 402×874）
-   包含一个半透明背景层（opacity < 1 或 fills 含透明色）
-   主要内容集中在 FRAME 底部区域（Y 坐标偏大）
-   主内容容器有顶部圆角（topLeftRadius / topRightRadius > 0）

**处理方式**：不要生成全屏 View，应生成 Modal / Sheet 组件，底部内容容器使用顶部圆角。

### 页面级 vs 组件级识别

| Figma 特征                                           | 识别为   | 说明                                       |
| ---------------------------------------------------- | -------- | ------------------------------------------ |
| 全屏 FRAME + 含 StatusBar + NavigationBar + 滚动内容 | **页面** | 生成为 `entries/xxx/index.tsx` 页面入口组件 |
| 非全屏 FRAME / 弹窗 / 卡片                          | **组件** | 生成为 `components/xxx/index.tsx` 子组件    |

### 应跳过的系统节点

| 节点特征                                         | 处理                                       |
| ------------------------------------------------ | ------------------------------------------ |
| name 含 "Status Bar"、"StatusBar" 的 INSTANCE    | **跳过** — 由系统 / 导航组件处理           |
| name 含 "Home Indicator" 的节点                  | **跳过** — 系统安全区自动处理              |
| name 含 "Navigation Bar"、"NavBar" 的 INSTANCE   | **优先复用**项目中已有的导航栏组件         |

---

## 6.5 图片资源处理策略

每个图片/资源节点必须先判断其**用途类型**，再决定实现方式。

### 必须用图片（禁止代码还原）的场景

| Figma 特征                        | 说明                             | 实现方式               |
| --------------------------------- | -------------------------------- | ---------------------- |
| BOOLEAN_OPERATION（任何类型）     | Subtract/Union/Intersect 路径运算 | CDN Image / ImageBackground |
| 大量重复 ELLIPSE / 装饰元素      | 圆点网格、星星背景等             | 整体导出为 CDN 图片    |
| 多层渐变叠加                      | 渐变 + 图片 + 渐变的组合        | CDN ImageBackground    |
| 复杂纹理 / 插画 / 手绘            | 不规则图形                       | CDN Image              |
| 邮票 / 锯齿边缘 / 异形容器       | BOOLEAN_OPERATION(Subtract) 等   | CDN ImageBackground    |

### 装饰性容器的识别与处理

当一个 FRAME 包含以下子节点组合时，应整体作为**装饰性容器**处理：

-   背景 IMAGE + 多个 ELLIPSE/RECTANGLE 装饰 + 渐变覆盖层
-   处理方式：外层 `ImageBackground`（CDN 地址），内部只保留**功能性子节点**（文字、按钮等）
-   装饰性子节点（ELLIPSE 点阵、渐变蒙层等）全部忽略，由背景图承载

### 用途分类与实现

| 用途类型       | 判断依据                                     | 实现方式                     |
| -------------- | -------------------------------------------- | ---------------------------- |
| **装饰性背景** | FRAME 含复杂子节点组合（见上）               | `ImageBackground` + CDN      |
| **图片按钮**   | 有交互标注、固定尺寸、用户提供了 CDN 地址    | `Image` + 可点击组件包裹     |
| **内容图片**   | 用户头像、商品图等业务内容                   | `Image` / `FastImage` + CDN  |
| **图标**       | 小尺寸、VECTOR / BOOLEAN_OPERATION           | CDN Image（非 SVG 重建）     |
| **进度条**     | 两个重叠 RECTANGLE（不同宽度）               | 外层 View + 内层 View(动态宽) |

---

## 7. 代码质量

### 忠实还原，禁止臆造

-   如果节点树中没有某个视觉元素的数据，**不要凭推测添加**
-   当不确定某个视觉细节如何实现时，应在方案展示阶段提出疑问，而非自行脑补

### 重复结构 → 数据驱动

当 Figma 中出现 **2 个及以上结构相同的同级节点**（如多个 GROUP/FRAME 内部结构一致）时：

-   **禁止**逐个硬编码为静态组件
-   **必须**识别为列表数据，生成 `data.map()` 或 FlatList/FlashList 渲染
-   单个节点的内容作为数据模型字段的参考，具体值来自 API
-   如果重复超过 4 个，必须提取为独立子组件

### Figma 帧名称中的业务语义

Figma 帧名称（FRAME 的 `name` 字段）可能包含业务状态信息：

-   示例：`"首次7天- VIP用户"`、`"已签到状态"`、`"空数据态"`
-   提取其中的状态语义（VIP / 非 VIP、首次 / 非首次）作为**条件渲染**的分支参考
-   但**不要**将帧名称作为文本内容使用（文本内容**只从 TEXT 节点的 `characters` 字段获取**）

### Figma 中可能存在的"未上线功能"

-   设计稿中可能包含已设计但实际代码中未启用的功能区域
-   在方案展示阶段明确标注哪些是"完整实现" vs "预留占位"
-   如果不确定，询问用户该功能是否需要生成代码

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
-   [ ] **尺寸适配**：是否按项目级规则的适配方案处理尺寸？尺寸数值是否精确还原？
-   [ ] **类型安全**：Props 是否定义了 interface？是否避免了 `any`？
-   [ ] **Hooks**：传给子组件的回调是否用 `useCallback` 包裹？
-   [ ] **框架规则**：是否遵守了对应框架的特定规则？
-   [ ] **项目级规则**：是否遵守了 `.aiwork/figma-rules.md` 中的额外约定？
-   [ ] **用户标注**：是否已按照节点 `annotation` 字段的说明处理？所有标注需求是否已满足？
-   [ ] **CDN 资源**：用户提供的所有 CDN 地址是否都已使用？是否有遗漏或被样式代码替代的？
-   [ ] **图片 vs 样式代码**：是否存在用样式代码模拟已有图片资源的情况？
-   [ ] **禁止臆造**：是否所有生成的视觉元素都有 Figma 节点数据支撑？有没有自行添加的装饰？

---

## 9. 交互代码生成规则

当需要生成带交互逻辑的代码时（不仅仅是静态 UI），遵循以下规则：

### 前置条件

1. **必须先读取技术方案**：使用 `get_tech_design` 获取技术方案
2. **必须先读取交互文档**：使用 `get_interaction_spec` 获取交互说明（如有）
3. **必须先读取 API 文档**：使用 `get_api_spec` 获取接口定义（如有）

### 用户标注（annotation）处理规则

节点树中的 `annotation` 字段是用户在 Figma 插件中为特定节点添加的 **AI 处理说明**。

**关键原则**：

-   标注中的要求 **优先级高于** AI 自身推断
-   如果标注与 AI 推断冲突，**以标注为准**
-   所有标注必须在方案展示阶段明确列出并说明处理方式

**常见标注类型**：

| 类型         | 示例                                            |
| ------------ | ----------------------------------------------- |
| 交互需求     | "需要支持下拉刷新和分页加载"                    |
| 数据绑定     | "显示 userProfile.nickname"                     |
| 组件替换     | "使用项目中的 CachedImage 组件"                 |
| 特殊处理     | "这个按钮点击后弹出分享面板"                    |
| 布局指示     | "这里用 FlatList 而不是 ScrollView"             |
| 忽略指示     | "这个节点仅用于设计参考，不需要生成代码"        |

**处理流程**：

1. 调用 `get_figma_selection` 后，首先检查 `meta.annotations` 汇总列表
2. 在方案展示阶段，逐一列出每条标注及对应的处理方式
3. 生成代码时，确保每条标注的要求都已落实
4. 生成完成后，在检查清单中确认所有标注已处理

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

---

## 9.5 非视觉代码生成指引

以下关注点在 Figma 设计稿中**不可见**，但真实代码中必须考虑。  
生成代码时应在**方案展示阶段**提醒用户是否需要添加。

### 错误边界

-   页面级组件建议包裹错误边界 HOC（如项目有统一方案）
-   在方案阶段询问用户项目是否有统一的错误边界方案
-   子组件如果包含网络请求或复杂逻辑，也应考虑错误边界

### 埋点 / 事件追踪

-   页面根节点是否需要**页面级曝光埋点**
-   按钮、卡片等可交互元素是否需要**点击埋点**
-   列表项是否需要**曝光埋点**
-   在方案阶段询问用户的埋点方案（如有 `DawnView`、`eventTracing` 等组件）

### 图片预加载

-   弹窗 / 浮层使用 CDN 背景图时，考虑 `Image.prefetch()` 预加载
-   避免弹出时出现白屏闪烁

### 滚动驱动交互

以下交互在 Figma 静态稿中**无法体现**，需要通过标注或用户确认：

-   导航栏随滚动改变透明度
-   Tab 栏吸顶效果
-   下拉刷新 / 上拉加载更多
-   在方案阶段主动询问是否需要这些交互
