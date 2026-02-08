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

| 场景                      | 推荐组件               |
| ------------------------- | ---------------------- |
| 长列表（同类型数据）      | `FlatList`             |
| 分组列表                  | `SectionList`          |
| 短列表（< 20 项静态内容） | `ScrollView` + `map()` |

---

## 6. Figma 特性映射

| Figma 特性    | React Native 处理                     |
| ------------- | ------------------------------------- |
| FRAME         | `View`                                |
| TEXT          | `Text`                                |
| RECTANGLE     | `View`                                |
| ELLIPSE       | `View` (with borderRadius)            |
| IMAGE         | `Image`                               |
| GROUP         | `View`                                |
| 线性渐变      | `react-native-linear-gradient`        |
| 模糊效果      | `@react-native-community/blur` 或跳过 |
| 内阴影        | 跳过或使用图片替代                    |
| 复杂路径/矢量 | 导出为 SVG，使用 `react-native-svg`   |

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

## 8. 检查清单

生成 React Native 代码后，确认：

-   [ ] 样式使用 `StyleSheet.create()` 而非内联
-   [ ] 文字都包裹在 `<Text>` 中
-   [ ] 图片设置了明确的宽高
-   [ ] 可点击元素使用 `TouchableOpacity` 或 `Pressable`
-   [ ] 长列表使用 `FlatList` 而非 `ScrollView` + `map()`
-   [ ] iOS/Android 阴影分别处理
