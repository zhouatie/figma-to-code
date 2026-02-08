#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { startWebSocketServer, stopWebSocketServer } from './websocket-server.js';
import { toolSchemas, getToolHandler } from './figma-tools.js';
import { workspaceToolSchemas, getWorkspaceToolHandler } from './workspace-tools.js';
import { designToolSchemas, getDesignToolHandler } from './design-tools.js';

const allToolSchemas = [...toolSchemas, ...workspaceToolSchemas, ...designToolSchemas];

function getAllToolHandler(name: string): ((args: Record<string, unknown>) => Promise<unknown>) | undefined {
  return getToolHandler(name) || getWorkspaceToolHandler(name) || getDesignToolHandler(name);
}

const server = new Server(
  {
    name: 'aiwork-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allToolSchemas,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = getAllToolHandler(name);
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

async function main() {
  startWebSocketServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] AI Work MCP Server started');
  console.error('[MCP] WebSocket server listening on ws://localhost:3001');
  console.error('[MCP] Ready to receive connections from Figma plugin');

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
