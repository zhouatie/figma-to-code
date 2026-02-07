#!/usr/bin/env node
// ============================================================
// Figma MCP Server - 入口文件
// ============================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { startWebSocketServer, stopWebSocketServer } from './websocket-server.js';
import { toolSchemas, getToolHandler } from './figma-tools.js';

// 创建 MCP Server
const server = new Server(
  {
    name: 'figma-to-code-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolSchemas,
  };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = getToolHandler(name);
  if (!handler) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `Unknown tool: ${name}` }),
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await handler(args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// 启动服务
async function main() {
  // 启动 WebSocket Server 接收 Figma 插件数据
  startWebSocketServer();

  // 启动 MCP Server (通过 stdio 与 Claude Code 通信)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Figma to Code MCP Server started');
  console.error('[MCP] WebSocket server listening on ws://localhost:3001');
  console.error('[MCP] Ready to receive connections from Figma plugin');

  // 优雅关闭
  process.on('SIGINT', () => {
    console.error('[MCP] Shutting down...');
    stopWebSocketServer();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error('[MCP] Shutting down...');
    stopWebSocketServer();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[MCP] Failed to start server:', error);
  process.exit(1);
});
