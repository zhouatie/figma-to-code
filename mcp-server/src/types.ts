// ============================================================
// 共享类型定义
// ============================================================

// Figma 节点数据 (与插件端保持一致)
export interface FigmaNodeData {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  width: number;
  height: number;
  x: number;
  y: number;

  // 布局
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  layoutWrap?: 'NO_WRAP' | 'WRAP';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;

  // 填充
  fills?: FigmaPaint[];

  // 描边
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';

  // 圆角
  cornerRadius?: number | 'mixed';
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;

  // 效果
  effects?: FigmaEffect[];

  // 透明度
  opacity?: number;
  blendMode?: string;

  // 文字
  characters?: string;
  fontSize?: number;
  fontName?: { family: string; style: string };
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';

  // 组件实例
  isInstance?: boolean;
  mainComponentName?: string;
  variantProperties?: Record<string, string>;

  // 约束
  constraints?: {
    horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  };

  // 子节点
  children?: FigmaNodeData[];
}

export interface FigmaPaint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  gradientStops?: FigmaGradientStop[];
  gradientHandlePositions?: { x: number; y: number }[];
  scaleMode?: string;
  imageHash?: string;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface FigmaGradientStop {
  position: number;
  color: FigmaColor;
}

export interface FigmaEffect {
  type: string;
  visible: boolean;
  radius: number;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  spread?: number;
}

export interface AssetExport {
  type: 'image' | 'icon' | 'vector';
  nodeId: string;
  nodeName: string;
  format: 'png' | 'jpg' | 'svg' | 'webp';
  data: string;
  inline?: boolean;
  usage?: {
    width: number;
    height: number;
  };
}

// Figma 插件发送的消息
export interface FigmaSelectionMessage {
  type: 'figma-selection';
  data: FigmaNodeData;
  assets: AssetExport[];
  timestamp: string;
}

// 项目配置
export interface ProjectConfig {
  framework: string;
  styling: {
    type: 'stylesheet' | 'inline' | 'tailwind' | 'styled-components';
    unit: 'px' | 'dp' | 'rem';
  };
  output: {
    componentDir: string;
    assetDir: string;
  };
  rules?: string;
  frameworkRulesDir?: string;
  componentMapsDir?: string;
  projectRules?: string;
}

// 组件映射规则
export interface ComponentMapRule {
  match: {
    type: 'instance' | 'name-pattern' | 'structure';
    componentName?: string;
    pattern?: string;
    heuristic?: string;
  };
  map: {
    component: string;
    import: string;
    propsMapping?: Record<string, string>;
    wrapChildren?: boolean;
  };
}

export interface ComponentMap {
  rules: ComponentMapRule[];
  fallback: Record<string, string>;
}

// ============================================================
// AI 工作区配置 (.aiwork/)
// ============================================================

/**
 * .aiwork/config.json 配置结构
 */
export interface WorkspaceConfig {
  /** 项目名称 */
  projectName: string;

  /** 框架配置 */
  framework: 'react-native' | 'react' | 'vue' | 'flutter' | string;

  /** 样式配置 */
  styling: {
    type: 'stylesheet' | 'inline' | 'tailwind' | 'styled-components';
    unit: 'px' | 'dp' | 'rem';
  };

  /** 输出目录配置 */
  output: {
    componentDir: string;
    screenDir?: string;
    assetDir: string;
  };

  /** 资源配置 */
  assets?: {
    images?: {
      outputDir: string;
      naming: 'kebab-case' | 'camelCase' | 'snake_case';
      scales?: number[];
      reference: 'require' | 'import' | 'uri';
    };
    icons?: {
      strategy: 'inline-svg' | 'icon-component' | 'font';
      componentImport?: string;
      svgDir?: string;
    };
  };

  /** 状态管理 */
  stateManagement?: 'zustand' | 'redux' | 'mobx' | 'jotai' | 'context' | string;

  /** 网络库 */
  networkLib?: 'axios' | 'fetch' | 'ky' | string;

  /** 路由/导航 */
  navigation?: 'react-navigation' | 'expo-router' | 'react-router' | string;

  /** 文档配置 */
  docs?: {
    /** 需求文档目录 */
    requirementsDir?: string;
    /** 技术方案目录 */
    designsDir?: string;
    /** 交互文档目录 */
    interactionsDir?: string;
    /** API 文档目录 */
    apiDir?: string;
  };
}

/**
 * 工作区文件类型
 */
export type WorkspaceFileType =
  | 'config'           // config.json
  | 'figma-rules'      // figma-rules.md
  | 'tech-rules'       // tech-design-rules.md
  | 'requirement'      // requirements/*.md
  | 'design'           // designs/*.md
  | 'interaction'      // interactions/*.md
  | 'api';             // api/*.md

/**
 * 工作区文件信息
 */
export interface WorkspaceFile {
  type: WorkspaceFileType;
  path: string;
  name: string;
  exists: boolean;
  lastModified?: string;
}

/**
 * 工作区状态
 */
export interface WorkspaceStatus {
  initialized: boolean;
  configPath: string;
  config?: WorkspaceConfig;
  files: WorkspaceFile[];
}
