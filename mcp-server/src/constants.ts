// ============================================================
// 路径常量和公共辅助函数
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import type { WorkspaceConfig } from './types.js';

// ===== 工作区目录和文件名常量 =====
export const WORKSPACE_DIR = '.aiwork';
export const CONFIG_FILE = 'config.json';
export const FIGMA_RULES_FILE = 'figma-rules.md';
export const TECH_RULES_FILE = 'tech-design-rules.md';
export const SYNC_FILE = 'figma-sync.json';

// ===== 公共路径辅助函数 =====

/**
 * 获取内置默认配置目录路径
 */
export function getDefaultsDir(): string {
    return join(dirname(new URL(import.meta.url).pathname), '..', 'defaults');
}

/**
 * 获取工作区目录路径
 */
export function getWorkspacePath(projectRoot: string): string {
    return join(resolve(projectRoot), WORKSPACE_DIR);
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(projectRoot: string): string {
    return join(getWorkspacePath(projectRoot), CONFIG_FILE);
}

/**
 * 获取同步记录文件路径
 */
export function getSyncFilePath(projectRoot: string = '.'): string {
    return join(getWorkspacePath(projectRoot), SYNC_FILE);
}

/**
 * 读取工作区配置
 */
export function readWorkspaceConfig(projectRoot: string): WorkspaceConfig | null {
    const configPath = getConfigPath(projectRoot);
    if (!existsSync(configPath)) return null;

    try {
        return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
        return null;
    }
}
