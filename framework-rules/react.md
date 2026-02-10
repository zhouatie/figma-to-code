# React 框架规则

本文件定义了 React 框架特定的代码生成规则。  
会与通用规则（`code-rules.md`）合并后使用，本文件优先级更高。

---

## 1. 样式系统

### CSS Modules（推荐）

-   **推荐**使用 CSS Modules（`*.module.css`）管理样式
-   类名自动作用域隔离，避免样式污染
-   支持与 Sass/Less 结合使用

```tsx
import styles from './Button.module.css';

function Button({ children }) {
    return <button className={styles.button}>{children}</button>;
}
```

### 内联样式

-   简单动态样式可使用内联 style
-   复杂样式应抽离到 CSS Modules

```tsx
<div style={{ opacity: isVisible ? 1 : 0 }}>内容</div>
```

### 条件类名

-   使用模板字符串或 `clsx`/`classnames` 库处理条件类名

```tsx
import clsx from 'clsx';
import styles from './Card.module.css';

<div className={clsx(styles.card, { [styles.active]: isActive })} />;
```

### CSS-in-JS（可选）

如果项目使用 styled-components 或 emotion：

```tsx
import styled from 'styled-components';

const Button = styled.button`
    padding: 8px 16px;
    background: ${(props) => (props.primary ? '#007bff' : '#fff')};
`;
```

---

## 2. 布局

### Flexbox / Grid

-   优先使用 Flexbox 实现一维布局
-   复杂二维布局使用 CSS Grid
-   使用 `gap` 属性控制元素间距（替代 margin hack）

### 绝对定位

-   Figma 中的绝对定位布局应**尽量转换为 Flexbox/Grid**
-   仅模态框、Tooltip、Dropdown 等浮层使用绝对定位
-   使用 `position: relative` 建立定位上下文

---

## 3. 组件模板

### 页面组件

```tsx
/**
 * PageName 页面
 * 简要说明页面功能
 */
import { useState, useEffect, useCallback } from 'react';

import CardItem from './components/CardItem';
import styles from './PageName.module.css';

interface PageNameProps {
    id?: string;
}

export default function PageName({ id }: PageNameProps) {
    const [data, setData] = useState(null);

    useEffect(() => {
        // 数据获取逻辑
    }, [id]);

    return (
        <div className={styles.container}>
            {/* 页面内容 */}
        </div>
    );
}
```

### 通用组件

```tsx
import { forwardRef } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
    size?: 'small' | 'medium' | 'large';
    loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'medium', loading, children, className, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={`${styles.button} ${styles[variant]} ${styles[size]} ${className || ''}`}
                disabled={loading || props.disabled}
                {...props}
            >
                {loading ? <span className={styles.spinner} /> : children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button;
```

### 子组件

```tsx
import styles from './CardItem.module.css';

interface CardItemProps {
    title: string;
    description?: string;
    onClick?: () => void;
}

function CardItem({ title, description, onClick }: CardItemProps) {
    return (
        <div className={styles.card} onClick={onClick}>
            <h3 className={styles.title}>{title}</h3>
            {description && <p className={styles.description}>{description}</p>}
        </div>
    );
}

export default CardItem;
```

---

## 4. 导入顺序

```tsx
// 1. React 核心
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// 2. 第三方库
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

// 3. 项目共享模块（路径别名）
import { Button, Modal } from '@/components';
import { useAuth } from '@/hooks';
import { formatDate } from '@/utils';

// 4. 类型定义
import type { User } from '@/types';

// 5. 页面私有模块（相对路径）
import CardItem from './components/CardItem';
import { usePageData } from './hooks';

// 6. 样式文件（放最后）
import styles from './PageName.module.css';
```

---

## 5. 核心元素规则

### 文字处理

-   语义化使用 HTML 标签（`h1-h6`, `p`, `span`, `label`）
-   避免过度使用 `div` 包裹文字

### 图片处理

-   使用语义化 `<img>` 标签或 Next.js `<Image>` 组件
-   **必须**设置 `alt` 属性
-   设置明确的 `width` 和 `height` 防止布局偏移
-   使用 `loading="lazy"` 延迟加载非首屏图片

```tsx
<img
    src="/images/hero.png"
    alt="Hero banner"
    width={800}
    height={400}
    loading="lazy"
/>
```

### 交互元素

-   可点击元素优先使用语义化标签（`<button>`, `<a>`）
-   表单元素使用 `<label>` 关联
-   提供 hover/focus/active 状态样式
-   键盘可访问（tabIndex, onKeyDown）

### 列表渲染

| 场景                      | 推荐方式                    |
| ------------------------- | --------------------------- |
| 静态短列表（< 20 项）     | `Array.map()` 直接渲染      |
| 动态列表                  | `Array.map()` + 唯一 `key`  |
| 超长列表（100+ 项）       | `react-window` 虚拟滚动     |
| 无限滚动                  | `react-infinite-scroll`     |

```tsx
{items.map((item) => (
    <CardItem key={item.id} title={item.title} />
))}
```

---

## 6. Figma 特性映射

| Figma 特性    | React 处理                              |
| ------------- | --------------------------------------- |
| FRAME         | `<div>` / `<section>` / `<article>`     |
| TEXT          | `<p>` / `<span>` / `<h1-h6>`            |
| RECTANGLE     | `<div>` with CSS                        |
| ELLIPSE       | `<div>` with `border-radius: 50%`       |
| IMAGE         | `<img>` / Next.js `<Image>`             |
| GROUP         | `<div>` / `<React.Fragment>`            |
| 线性渐变      | CSS `linear-gradient()`                 |
| 径向渐变      | CSS `radial-gradient()`                 |
| 模糊效果      | CSS `filter: blur()` / `backdrop-filter`|
| 阴影          | CSS `box-shadow`                        |
| 复杂路径/矢量 | 导出为 SVG，内联或作为组件              |

---

## 7. 响应式设计

### 媒体查询断点（推荐）

```css
/* Mobile First */
.container {
    padding: 16px;
}

/* Tablet */
@media (min-width: 768px) {
    .container {
        padding: 24px;
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .container {
        padding: 32px;
        max-width: 1200px;
        margin: 0 auto;
    }
}
```

### 相对单位

-   字体大小使用 `rem`（基于根元素）
-   间距可使用 `em` 或 `rem`
-   避免固定 `px` 宽度，使用百分比或 `max-width`

### 容器查询（现代浏览器）

```css
.card-container {
    container-type: inline-size;
}

@container (min-width: 400px) {
    .card {
        flex-direction: row;
    }
}
```

---

## 8. 可访问性（A11y）

### 基础要求

-   图片必须有 `alt` 属性
-   表单元素必须有关联的 `<label>`
-   交互元素必须可键盘访问
-   颜色对比度符合 WCAG 标准

### ARIA 属性

```tsx
<button aria-label="关闭对话框" aria-expanded={isOpen}>
    <CloseIcon />
</button>

<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <h2 id="dialog-title">确认删除</h2>
</div>
```

### 焦点管理

```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
    if (isOpen) {
        inputRef.current?.focus();
    }
}, [isOpen]);
```

---

## 9. 性能优化

### 避免不必要的重渲染

```tsx
// 使用 memo 包裹纯展示组件
const CardItem = memo(function CardItem({ title }: Props) {
    return <div>{title}</div>;
});

// 使用 useMemo 缓存计算结果
const sortedItems = useMemo(() => {
    return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// 使用 useCallback 缓存回调函数
const handleClick = useCallback(() => {
    onClick(id);
}, [onClick, id]);
```

### 代码分割

```tsx
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
    return (
        <Suspense fallback={<Loading />}>
            <HeavyComponent />
        </Suspense>
    );
}
```

### 图片优化

-   使用 WebP/AVIF 格式
-   提供响应式图片（`srcset`）
-   使用 `loading="lazy"` 延迟加载

---

## 10. 表单处理

### 受控组件（推荐）

```tsx
const [value, setValue] = useState('');

<input
    type="text"
    value={value}
    onChange={(e) => setValue(e.target.value)}
/>;
```

### 结合表单库（复杂表单）

推荐使用 `react-hook-form` + `zod` 进行表单验证：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
    email: z.string().email('请输入有效邮箱'),
    password: z.string().min(6, '密码至少6位'),
});

function LoginForm() {
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
    });

    const onSubmit = (data) => {
        console.log(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('email')} />
            {errors.email && <span>{errors.email.message}</span>}
            <button type="submit">提交</button>
        </form>
    );
}
```

---

## 11. 检查清单

生成 React 代码后，确认：

-   [ ] 组件使用函数式组件 + Hooks
-   [ ] 样式使用 CSS Modules 或项目指定的样式方案
-   [ ] 图片设置了 `alt`、`width`、`height` 属性
-   [ ] 列表渲染使用唯一且稳定的 `key`
-   [ ] 交互元素使用语义化 HTML 标签
-   [ ] 表单元素有关联的 `<label>`
-   [ ] 导入顺序符合规范
-   [ ] 没有不必要的 `div` 嵌套
-   [ ] 类型定义完整（TypeScript）
-   [ ] 无内存泄漏（useEffect 清理函数）
