// ============================================================
// Figma Node Data Extractor
// 从 Figma SceneNode 提取结构化数据
// ============================================================

import type { FigmaNodeData, FigmaPaint, FigmaEffect, FigmaColor, AssetExport } from './types';

// 提取节点完整数据
export function extractNodeData(node: SceneNode): FigmaNodeData {
  const base: FigmaNodeData = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    width: node.width,
    height: node.height,
    x: node.x,
    y: node.y,
  };

  // 读取 AI 标注
  const annotation = node.getPluginData('ai-annotation');
  if (annotation) {
    base.annotation = annotation;
  }

  // 透明度
  if ('opacity' in node) {
    base.opacity = node.opacity;
  }

  // 混合模式
  if ('blendMode' in node) {
    base.blendMode = node.blendMode;
  }

  // 布局属性 (Auto Layout)
  if ('layoutMode' in node) {
    base.layoutMode = node.layoutMode;
    base.primaryAxisAlignItems = node.primaryAxisAlignItems;
    base.counterAxisAlignItems = node.counterAxisAlignItems;
    base.itemSpacing = node.itemSpacing;
    base.paddingTop = node.paddingTop;
    base.paddingRight = node.paddingRight;
    base.paddingBottom = node.paddingBottom;
    base.paddingLeft = node.paddingLeft;

    if ('layoutSizingHorizontal' in node) {
      base.layoutSizingHorizontal = node.layoutSizingHorizontal;
      base.layoutSizingVertical = node.layoutSizingVertical;
    }

    if ('layoutWrap' in node) {
      base.layoutWrap = node.layoutWrap;
    }
  }

  // 填充
  if ('fills' in node && Array.isArray(node.fills)) {
    base.fills = (node.fills as readonly Paint[]).map(convertPaint);
  }

  // 描边
  if ('strokes' in node && Array.isArray(node.strokes)) {
    base.strokes = (node.strokes as readonly Paint[]).map(convertPaint);
    base.strokeWeight = (node as GeometryMixin).strokeWeight as number;
    base.strokeAlign = (node as GeometryMixin).strokeAlign;
  }

  // 圆角
  if ('cornerRadius' in node) {
    const frameNode = node as FrameNode | RectangleNode;
    if (typeof frameNode.cornerRadius === 'number') {
      base.cornerRadius = frameNode.cornerRadius;
    } else {
      base.cornerRadius = 'mixed';
      base.topLeftRadius = frameNode.topLeftRadius;
      base.topRightRadius = frameNode.topRightRadius;
      base.bottomRightRadius = frameNode.bottomRightRadius;
      base.bottomLeftRadius = frameNode.bottomLeftRadius;
    }
  }

  // 效果
  if ('effects' in node && Array.isArray(node.effects)) {
    base.effects = (node.effects as readonly Effect[]).map(convertEffect);
  }

  // 约束
  if ('constraints' in node) {
    base.constraints = (node as ConstraintMixin).constraints;
  }

  // 文字属性
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    base.characters = textNode.characters;

    // 处理可能的 mixed 值
    if (typeof textNode.fontSize === 'number') {
      base.fontSize = textNode.fontSize;
    }

    if (textNode.fontName !== figma.mixed) {
      base.fontName = textNode.fontName as { family: string; style: string };
    }

    base.textAlignHorizontal = textNode.textAlignHorizontal;
    base.textAlignVertical = textNode.textAlignVertical;

    if (textNode.lineHeight !== figma.mixed) {
      const lh = textNode.lineHeight as LineHeight;
      if (lh.unit !== 'AUTO') {
        base.lineHeight = { value: lh.value, unit: lh.unit };
      }
    }

    if (textNode.letterSpacing !== figma.mixed) {
      base.letterSpacing = textNode.letterSpacing as LetterSpacing;
    }

    if (textNode.textDecoration !== figma.mixed) {
      base.textDecoration = textNode.textDecoration;
    }

    if (textNode.textCase !== figma.mixed) {
      base.textCase = textNode.textCase;
    }
  }

  // 组件实例
  if (node.type === 'INSTANCE') {
    const instanceNode = node as InstanceNode;
    base.isInstance = true;
    base.mainComponentName = instanceNode.mainComponent?.name;
    base.variantProperties = instanceNode.variantProperties || undefined;
  }

  // 子节点
  if ('children' in node) {
    base.children = (node as ChildrenMixin).children
      .filter((child) => child.visible)
      .map(extractNodeData);
  }

  return base;
}

// 转换 Paint 类型
function convertPaint(paint: Paint): FigmaPaint {
  const result: FigmaPaint = {
    type: paint.type,
    visible: paint.visible,
    opacity: paint.opacity,
  };

  if (paint.type === 'SOLID') {
    result.color = convertColor(paint.color);
  } else if (
    paint.type === 'GRADIENT_LINEAR' ||
    paint.type === 'GRADIENT_RADIAL' ||
    paint.type === 'GRADIENT_ANGULAR' ||
    paint.type === 'GRADIENT_DIAMOND'
  ) {
    result.gradientStops = paint.gradientStops.map((stop) => ({
      position: stop.position,
      color: convertColor(stop.color),
    }));
    result.gradientHandlePositions = paint.gradientHandlePositions;
  } else if (paint.type === 'IMAGE') {
    result.scaleMode = paint.scaleMode;
    result.imageHash = paint.imageHash || undefined;
  }

  return result;
}

// 转换 Effect 类型
function convertEffect(effect: Effect): FigmaEffect {
  const result: FigmaEffect = {
    type: effect.type,
    visible: effect.visible,
    radius: effect.radius,
  };

  if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
    result.color = convertColor(effect.color);
    result.offset = effect.offset;
    result.spread = effect.spread;
  }

  return result;
}

// 转换颜色
function convertColor(color: RGB | RGBA): FigmaColor {
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: 'a' in color ? color.a : 1,
  };
}

// ============================================================
// 资源导出
// ============================================================

export async function exportAssets(node: SceneNode): Promise<AssetExport[]> {
  const assets: AssetExport[] = [];

  async function traverse(n: SceneNode): Promise<void> {
    // 1. 检查图片填充
    if ('fills' in n && Array.isArray(n.fills)) {
      const imageFills = (n.fills as readonly Paint[]).filter(
        (f) => f.type === 'IMAGE' && f.visible !== false
      );

      for (const _fill of imageFills) {
        try {
          const bytes = await n.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 2 },
          });

          assets.push({
            type: 'image',
            nodeId: n.id,
            nodeName: sanitizeFileName(n.name),
            format: 'png',
            data: uint8ArrayToBase64(bytes),
            usage: { width: n.width, height: n.height },
          });
        } catch (e) {
          console.error('Export image failed:', e);
        }
      }
    }

    // 2. 矢量节点 - 判断是否为图标
    if (n.type === 'VECTOR' || n.type === 'BOOLEAN_OPERATION') {
      const isIcon = isLikelyIcon(n);

      try {
        const svgBytes = await n.exportAsync({ format: 'SVG' });
        assets.push({
          type: isIcon ? 'icon' : 'vector',
          nodeId: n.id,
          nodeName: sanitizeFileName(n.name),
          format: 'svg',
          data: uint8ArrayToString(svgBytes),
          inline: isIcon,
          usage: { width: n.width, height: n.height },
        });
      } catch (e) {
        console.error('Export SVG failed:', e);
      }
    }

    // 3. 显式导出标记 (以 export/ 开头)
    if (n.name.startsWith('export/')) {
      try {
        const bytes = await n.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 },
        });

        assets.push({
          type: 'image',
          nodeId: n.id,
          nodeName: sanitizeFileName(n.name.replace('export/', '')),
          format: 'png',
          data: uint8ArrayToBase64(bytes),
          usage: { width: n.width, height: n.height },
        });
      } catch (e) {
        console.error('Export marked node failed:', e);
      }
    }

    // 递归处理子节点
    if ('children' in n) {
      for (const child of (n as ChildrenMixin).children) {
        await traverse(child);
      }
    }
  }

  await traverse(node);
  return assets;
}

// 判断是否可能是图标
function isLikelyIcon(node: SceneNode): boolean {
  const maxIconSize = 64;
  const isSmall = node.width <= maxIconSize && node.height <= maxIconSize;
  const nameHint = /icon|ico|arrow|chevron|check|close|menu|plus|minus|search/i.test(node.name);
  return isSmall || nameHint;
}

// 文件名净化
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Uint8Array 转 Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Uint8Array 转字符串
function uint8ArrayToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
