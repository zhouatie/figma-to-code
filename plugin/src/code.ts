// ============================================================
// Figma Plugin - Main Code (Sandbox)
// 运行在 Figma 的沙箱环境中
// ============================================================

import { extractNodeData, exportAssets } from './extractor';
import type { PluginMessage, UIMessage } from './types';

// 显示 UI
figma.showUI(__html__, {
  width: 320,
  height: 480,
  themeColors: true,
});

// 监听选中变化
figma.on('selectionchange', async () => {
  await handleSelectionChange();
});

// 处理选中变化
async function handleSelectionChange(): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    sendToUI({ type: 'selection-changed', data: null, assets: [] });
    return;
  }

  // 目前只处理第一个选中的节点
  const node = selection[0];

  try {
    // 提取节点数据
    const nodeData = extractNodeData(node);

    // 导出资源
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

// 接收 UI 消息
figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'request-selection':
      await handleSelectionChange();
      break;

    case 'export-assets':
      const node = figma.getNodeById(msg.nodeId);
      if (node && 'exportAsync' in node) {
        const assets = await exportAssets(node as SceneNode);
        sendToUI({ type: 'export-complete', assets });
      }
      break;
  }
};

// 发送消息到 UI
function sendToUI(message: PluginMessage): void {
  figma.ui.postMessage(message);
}

// 初始化时获取当前选中
handleSelectionChange();
