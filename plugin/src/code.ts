// ============================================================
// Figma Plugin - Main Code (Sandbox)
// 运行在 Figma 的沙箱环境中
// ============================================================

import { extractNodeData, exportAssets } from './extractor';
import type { PluginMessage, UIMessage } from './types';

figma.showUI(__html__, {
  width: 360,
  height: 560,
  themeColors: true,
});

let debounceTimer: number | null = null;
const DEBOUNCE_DELAY = 150;

figma.on('selectionchange', () => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    handleSelectionChange();
    debounceTimer = null;
  }, DEBOUNCE_DELAY) as unknown as number;
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
        await handleSelectionChange();
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
  }
};

function sendToUI(message: PluginMessage): void {
  figma.ui.postMessage(message);
}

handleSelectionChange();
