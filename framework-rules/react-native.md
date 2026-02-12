# React Native 框架规则

本文件定义了 React Native 框架特定的代码生成规则。  
会与通用规则（`code-rules.md`）合并后使用，本文件优先级更高。

---

## 1. 样式系统

### StyleSheet

-   **必须**使用 `StyleSheet.create()` 定义样式
-   **禁止**内联样式（`style={{ ... }}`），除非是动态值
-   动态样式使用数组形式：`style={[styles.base, { opacity: value }]}`
-   复杂组件的样式可以分离到 `styles.ts` 文件

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

## 2. 布局

### Flexbox

-   使用 margin 或 `gap`（RN 0.71+）实现元素间距
-   `justifyContent` 和 `alignItems` 显式声明

### 绝对定位

-   Figma 中的绝对定位布局应**尽量转换为 Flexbox**
-   仅浮动元素（悬浮按钮、覆盖层）使用 `position: 'absolute'`

---

## 3. 组件模板

### 页面入口组件

```tsx
/**
 * PageName 页面
 * 简要说明页面功能
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import CardItem from './components/CardItem';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
});

interface PageNameProps {
    // navigation prop 类型取决于项目的导航库配置
}

export default function PageName({}: PageNameProps): React.ReactElement {
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

## 4. 导入顺序

```tsx
// 1. React 核心
import React, { useState, useEffect, useCallback, useMemo } from 'react';

// 2. React Native 组件
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';

// 3. 第三方库
import { SomeLibrary } from 'some-library';

// 4. 项目共享模块（路径别名）
import SomeComponent from '@components/SomeComponent';

// 5. 类型定义
import type { SomeType } from '@/types';

// 6. 页面私有模块（相对路径）
import CardItem from './components/CardItem';
```

---

## 5. 核心组件规则

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
-   提供 `activeOpacity={0.8}` 反馈
-   避免嵌套可点击元素

### 列表选择

| 场景                          | 推荐组件                        | 说明                                                         |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------ |
| 长列表（> 50 项同类型）       | `FlashList` / `AnimatedFlashList` | 性能最优，需指定 `estimatedItemSize`                         |
| 普通列表（20-50 项）          | `FlatList`                      | RN 内置，兼容性好                                            |
| 分组列表                      | `SectionList`                   | 有分组头部的场景                                             |
| 短列表（< 20 项静态内容）     | `ScrollView` + `map()`          | 简单场景                                                     |
| 多列网格                      | `FlashList` + `numColumns`      | 计算 `itemWidth = (screenWidth - padding - gaps) / numColumns` |
| 需要动画的长列表              | `AnimatedFlashList`             | 配合 `reanimated` 使用                                       |

---

## 6. Figma 特性映射

### 基础映射

| Figma 特性        | React Native 处理                                                |
| ----------------- | ---------------------------------------------------------------- |
| FRAME             | `View`                                                           |
| TEXT              | `Text`（**必须读取 `characters` 字段，非 `name`**）              |
| RECTANGLE         | `View`（with borderRadius if needed）                            |
| ELLIPSE           | `View`（with `borderRadius: width / 2`）                        |
| IMAGE             | `Image` / `FastImage`                                            |
| GROUP             | `View`（通常可展平，不一定需要额外包裹）                        |
| VECTOR            | 导出为 CDN 图片，**不用 react-native-svg 重建**                 |
| BOOLEAN_OPERATION | **CDN Image / ImageBackground**（禁止代码还原路径运算）         |
| INSTANCE          | 根据 `variantProperties` 映射到动态数据组件                     |

### 复合模式映射

| Figma 模式                                         | React Native 实现                                            |
| -------------------------------------------------- | ------------------------------------------------------------ |
| 全屏 FRAME + 半透明背景 + 底部圆角内容             | `Modal` / `DraggableSheet` 底部弹出层                        |
| 多个结构相同的 GROUP / FRAME                       | `FlatList` / `FlashList` + `renderItem` 数据驱动             |
| FRAME（layoutMode=NONE）                           | 按 Y 坐标分组推断 Flex 布局                                  |
| FRAME 含背景 IMAGE + 装饰层                        | `ImageBackground` + CDN                                      |
| 重叠的两个 RECTANGLE（不同宽度）                   | 进度条：外层 `View` + 内层 `View`（width 动态计算）          |
| 线性渐变 fills                                     | `LinearGradient` 组件                                        |
| 渐变 fills 应用于 TEXT                             | iOS: `MaskedView` + `LinearGradient`；Android: 降级纯色      |
| 多个 TEXT 节点不同 fontFamily                      | 多个 `<Text>` 并排，`flexDirection: 'row'` + `alignItems: 'baseline'` |

### 应跳过的节点

| 节点特征                              | 原因                              |
| ------------------------------------- | --------------------------------- |
| name 含 "Status Bar" / "StatusBar"    | 系统状态栏，由导航组件管理        |
| name 含 "Home Indicator"             | 系统安全区，自动处理              |
| 大量排列的 ELLIPSE（装饰点阵）       | 合并为 CDN 背景图                 |
| opacity = 0 的节点                    | 隐藏元素，跳过                    |

---

## 6.5 平台差异处理

### 渐变文字

```tsx
import { Platform } from 'react-native';

// iOS - 使用 MaskedView + LinearGradient
{Platform.OS === 'ios' ? (
  <MaskedView maskElement={<Text style={styles.gradientText}>{text}</Text>}>
    <LinearGradient colors={['#FF6B6B', '#FFD93D']}>
      <Text style={[styles.gradientText, { opacity: 0 }]}>{text}</Text>
    </LinearGradient>
  </MaskedView>
) : (
  // Android - 降级为纯色（取渐变首色）
  <Text style={[styles.gradientText, { color: '#FF6B6B' }]}>{text}</Text>
)}
```

### 模糊效果

-   iOS：使用 `BlurView`（`@react-native-community/blur`）
-   Android：降级为 `Image`（模糊处理后的图片）+ 半透明 `View` 覆盖层

### 常见平台差异速查

| 场景         | iOS                             | Android                          |
| ------------ | ------------------------------- | -------------------------------- |
| 渐变文字     | MaskedView + LinearGradient     | 降级为纯色                       |
| 阴影         | shadowColor/Offset/Opacity/Radius | elevation                      |
| 模糊背景     | BlurView                        | Image + overlay 降级             |
| fontWeight   | 支持 '100'-'900'                | 部分机型仅 'normal' / 'bold'    |
| 内阴影       | 跳过或使用图片替代              | 跳过或使用图片替代               |

---

## 7. 响应式尺寸

### 默认方案

直接使用 Figma 中的 dp 数值（React Native 默认 dp 单位）。

### rem 缩放方案（项目可配置）

如果项目使用 rem 缩放，在项目级规则中指定：

```tsx
import { rem } from '@utils/index';

// rem = screenWidth / designWidth（如 402）
const ITEM_WIDTH = 130 * rem;
fontSize: 13 * rem,
```

---

## 8. 常用模式参考

### Bottom Sheet / Modal 弹窗

```tsx
<Modal visible={visible} transparent animationType="slide">
  <View style={styles.overlay}>
    <View style={styles.sheetContainer}>
      {/* 内容 */}
    </View>
  </View>
</Modal>

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,  // 如项目使用 rem 缩放，替换为 16 * rem
    borderTopRightRadius: 16,
  },
});
```

### 展开 / 收起动画

```tsx
import { LayoutAnimation } from 'react-native';

const toggleExpand = useCallback(() => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setExpanded((prev) => !prev);
}, []);
```

### 多列网格计算

```tsx
const NUM_COLUMNS = 3;
const PADDING = 16;   // 如项目使用 rem 缩放，替换为 16 * rem
const GAP = 8;        // 如项目使用 rem 缩放，替换为 8 * rem
const ITEM_WIDTH =
  (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
```

### 图片预加载（弹窗背景）

```tsx
useEffect(() => {
  Image.prefetch(BG_CDN_URL);
}, []);
```

### 条件渲染（VIP / 非 VIP）

```tsx
// 根据 Figma 帧名称中的状态信息推断条件分支
{isVip ? <VipContent /> : <NormalContent />}
```

### 进度条

```tsx
// Figma 中表现为两个重叠的 RECTANGLE
<View style={styles.progressBg}>
  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
</View>
```

### 混合字体文本

```tsx
// 数字用 Outfit，汉字用 PingFang — 使用 StyleSheet 而非内联样式
const styles = StyleSheet.create({
  mixedTextRow: { flexDirection: 'row', alignItems: 'baseline' },
  numberText: { fontFamily: 'Outfit-Bold', fontSize: 24 },   // 如项目使用 rem 缩放，乘以 rem
  unitText: { fontFamily: 'PingFangSC-Regular', fontSize: 14 },
});

<View style={styles.mixedTextRow}>
  <Text style={styles.numberText}>7</Text>
  <Text style={styles.unitText}>天</Text>
</View>
```

---

## 9. 检查清单

生成 React Native 代码后，确认：

### 基础规范

-   [ ] 样式使用 `StyleSheet.create()` 而非内联
-   [ ] 所有文字包裹在 `<Text>` 中
-   [ ] 图片设置了明确的宽高
-   [ ] 可点击元素使用 `TouchableOpacity` 或 `Pressable`

### Figma 节点处理

-   [ ] TEXT 节点使用 `characters` 而非 `name` 获取文本内容
-   [ ] BOOLEAN_OPERATION 节点全部使用 CDN 图片，未尝试代码还原
-   [ ] INSTANCE 重复节点使用数据驱动渲染（`map` / `FlatList`）
-   [ ] `layoutMode=NONE` 的 FRAME 已推断为合理的 Flex 布局
-   [ ] 装饰性复杂节点（点阵、渐变叠加）已合并为 CDN 图片
-   [ ] StatusBar、Home Indicator 节点已跳过

### 性能

-   [ ] 长列表使用 `FlashList` / `FlatList` 而非 `ScrollView` + `map()`
-   [ ] 弹窗 CDN 背景考虑了 `Image.prefetch`
-   [ ] 列表项组件使用 `memo` 包裹

### 平台兼容

-   [ ] iOS / Android 阴影分别处理
-   [ ] 渐变文字处理了 iOS / Android 差异
-   [ ] `fontWeight` 考虑了 Android 兼容性
