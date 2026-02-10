// ============================================================
// Figma Plugin - Main Code (Sandbox)
// 运行在 Figma 的沙箱环境中
// ============================================================

import { extractNodeData, exportAssets } from './extractor';
import type { PluginMessage, UIMessage } from './types';

const NORMAL_WIDTH = 360;
const NORMAL_HEIGHT = 560;
const MINIMIZED_SIZE = 70;
const CORNER_PADDING = 20;

let isMinimized = false;
let lastPosition: { x: number; y: number } | null = null;

figma.showUI(__html__, {
  width: NORMAL_WIDTH,
  height: NORMAL_HEIGHT,
  themeColors: true,
});

async function handleSelectionChange(): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    sendToUI({ type: 'selection-changed', data: null, assets: [] });
    return;
  }

  const node = selection[0];

  try {
    const nodeData = extractNodeData(node);
    const assets = await exportAssets(node);

    sendToUI({
      type: 'selection-changed',
      data: nodeData,
      assets,
    });
  } catch (error) {
    sendToUI({
      type: 'error',
      message: `提取数据失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'request-selection':
      await handleSelectionChange();
      break;

    case 'export-assets': {
      const node = figma.getNodeById(msg.nodeId);
      if (node && 'exportAsync' in node) {
        const assets = await exportAssets(node as SceneNode);
        sendToUI({ type: 'export-complete', assets });
      }
      break;
    }

    case 'set-annotation': {
      const node = figma.getNodeById(msg.nodeId);
      if (node) {
        node.setPluginData('ai-annotation', msg.text);
        sendToUI({
          type: 'annotation-updated',
          nodeId: msg.nodeId,
          annotation: msg.text,
        });
      } else {
        sendToUI({
          type: 'error',
          message: `节点不存在: ${msg.nodeId}`,
        });
      }
      break;
    }

    case 'get-annotation': {
      const node = figma.getNodeById(msg.nodeId);
      if (node) {
        const annotation = node.getPluginData('ai-annotation') || '';
        sendToUI({
          type: 'annotation-loaded',
          nodeId: msg.nodeId,
          annotation,
        });
      }
      break;
    }

    case 'select-node': {
      const node = figma.getNodeById(msg.nodeId);
      if (node && 'absoluteBoundingBox' in node) {
        figma.currentPage.selection = [node as SceneNode];
      } else {
        sendToUI({
          type: 'error',
          message: `节点不存在: ${msg.nodeId}`,
        });
      }
      break;
    }

    case 'minimize-window': {
      if (!isMinimized) {
        lastPosition = figma.ui.getPosition().canvasSpace;
        const viewport = figma.viewport.bounds;
        const cornerX = viewport.x + viewport.width - MINIMIZED_SIZE - CORNER_PADDING;
        const cornerY = viewport.y + viewport.height - MINIMIZED_SIZE - CORNER_PADDING;
        
        figma.ui.hide();
        figma.ui.show();
        figma.ui.resize(MINIMIZED_SIZE, MINIMIZED_SIZE);
        figma.ui.reposition(cornerX, cornerY);
        isMinimized = true;
        sendToUI({ type: 'window-state-changed', minimized: true });
      }
      break;
    }

    case 'restore-window': {
      if (isMinimized) {
        figma.ui.hide();
        figma.ui.show();
        figma.ui.resize(NORMAL_WIDTH, NORMAL_HEIGHT);
        if (lastPosition) {
          figma.ui.reposition(lastPosition.x, lastPosition.y);
        }
        isMinimized = false;
        sendToUI({ type: 'window-state-changed', minimized: false });
      }
      break;
    }
  }
};

function sendToUI(message: PluginMessage): void {
  figma.ui.postMessage(message);
}

handleSelectionChange();
