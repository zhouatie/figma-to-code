// ============================================================
// Figma Plugin Types
// ============================================================

// 提取的节点数据结构
export interface FigmaNodeData {
  id: string;
  name: string;
  type: string;
  visible: boolean;

  // 尺寸与位置
  width: number;
  height: number;
  x: number;
  y: number;

  // 布局属性 (Auto Layout)
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  layoutWrap?: 'NO_WRAP' | 'WRAP';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
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

  // 效果 (阴影、模糊等)
  effects?: FigmaEffect[];

  // 透明度与混合
  opacity?: number;
  blendMode?: string;

  // 文字属性 (仅 TEXT 节点)
  characters?: string;
  fontSize?: number;
  fontName?: { family: string; style: string };
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';

  // 组件实例属性
  isInstance?: boolean;
  mainComponentName?: string;
  variantProperties?: Record<string, string>;

  // 约束 (用于绝对定位)
  constraints?: {
    horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  };

  // AI 标注 (用户添加的处理说明)
  annotation?: string;

  // 子节点
  children?: FigmaNodeData[];
}

// 填充/描边类型
export interface FigmaPaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE' | 'VIDEO';
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  gradientStops?: FigmaGradientStop[];
  gradientHandlePositions?: { x: number; y: number }[];
  scaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
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

// 效果类型
export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible: boolean;
  radius: number;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  spread?: number;
}

// 导出的资源
export interface AssetExport {
  type: 'image' | 'icon' | 'vector';
  nodeId: string;
  nodeName: string;
  format: 'png' | 'jpg' | 'svg' | 'webp';
  data: string; // base64 或 SVG 字符串
  inline?: boolean;
  usage?: {
    width: number;
    height: number;
  };
}

// 组件匹配结果
export interface ComponentMatch {
  matchType: 'component-instance' | 'naming-convention' | 'structure-heuristic' | 'primitive';
  figmaName: string;
  inferredComponent?: string;
  variants?: Record<string, string>;
  primitiveType?: string;
  confidence: number;
}

// 插件与 UI 之间的消息类型
export type PluginMessage =
  | { type: 'selection-changed'; data: FigmaNodeData | null; assets: AssetExport[] }
  | { type: 'export-complete'; assets: AssetExport[] }
  | { type: 'annotation-updated'; nodeId: string; annotation: string }
  | { type: 'annotation-loaded'; nodeId: string; annotation: string }
  | { type: 'error'; message: string }
  | { type: 'status'; message: string };

export type UIMessage =
  | { type: 'request-selection' }
  | { type: 'export-assets'; nodeId: string }
  | { type: 'set-annotation'; nodeId: string; text: string }
  | { type: 'get-annotation'; nodeId: string }
  | { type: 'connect-server'; url: string }
  | { type: 'disconnect-server' };
