// ============================================================
// 数据存储 - 通过文件系统共享 Figma 插件数据
// WebSocket 进程写入 → MCP stdio 进程读取，解决跨进程数据隔离
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { FigmaNodeData, AssetExport, FigmaSelectionMessage } from './types.js';

export interface SelectionRecord {
  data: FigmaNodeData;
  assets: AssetExport[];
  timestamp: string;
  receivedAt: string;
}

interface StoredData {
  currentSelection: SelectionRecord | null;
  selectionHistory: SelectionRecord[];
}

const DATA_DIR = join(tmpdir(), 'figma-mcp-data');
const SELECTION_FILE = join(DATA_DIR, 'selection.json');
const MAX_HISTORY_SIZE = 20;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData(): StoredData {
  try {
    if (existsSync(SELECTION_FILE)) {
      const content = readFileSync(SELECTION_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[DataStore] Failed to read data file:', error);
  }
  return { currentSelection: null, selectionHistory: [] };
}

function writeData(data: StoredData): void {
  try {
    ensureDataDir();
    writeFileSync(SELECTION_FILE, JSON.stringify(data), 'utf-8');
  } catch (error) {
    console.error('[DataStore] Failed to write data file:', error);
  }
}

class DataStore {
  // 更新当前选中
  setSelection(message: FigmaSelectionMessage): void {
    const record: SelectionRecord = {
      data: message.data,
      assets: message.assets,
      timestamp: message.timestamp,
      receivedAt: new Date().toISOString(),
    };

    const stored = readData();
    stored.currentSelection = record;

    // 添加到历史记录
    stored.selectionHistory.unshift(record);
    if (stored.selectionHistory.length > MAX_HISTORY_SIZE) {
      stored.selectionHistory = stored.selectionHistory.slice(0, MAX_HISTORY_SIZE);
    }

    writeData(stored);
    console.log(`[DataStore] Selection updated: ${message.data.name} (${message.data.type})`);
    console.log(`[DataStore] Data written to: ${SELECTION_FILE}`);
  }

  // 获取当前选中
  getSelection(): SelectionRecord | null {
    return readData().currentSelection;
  }

  // 获取历史记录
  getHistory(): SelectionRecord[] {
    return readData().selectionHistory;
  }

  // 清空数据
  clear(): void {
    writeData({ currentSelection: null, selectionHistory: [] });
  }

  // 检查是否有数据
  hasSelection(): boolean {
    return readData().currentSelection !== null;
  }

  // 获取统计信息
  getStats(): { hasSelection: boolean; historyCount: number; lastUpdate: string | null } {
    const stored = readData();
    return {
      hasSelection: stored.currentSelection !== null,
      historyCount: stored.selectionHistory.length,
      lastUpdate: stored.currentSelection?.timestamp || null,
    };
  }

  getDataPath(): string {
    return SELECTION_FILE;
  }
}

// 单例导出
export const dataStore = new DataStore();
