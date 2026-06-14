// MCP Server + LAP + remote device setup
// Shared between personal and org servers
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createGaeaMcpServer, handleMcpSSE, handleMcpMessage } from "../mcp/gaea_server";
import { attachMcpWebSocket, connectMcpServerToRemote } from "../mcp/ws_transport";
import { attachLAPWebSocket } from "../lap/transport";
import { toolRegistry } from "../tools/registry";
import { deviceRegistry } from "../devices";
import { requireAuth } from "../middleware/auth";
import fs from "fs";
import path from "path";

export function setupMcpServer(
  app: express.Express,
  server: http.Server,
  io: Server,
  llm: { getDeepSeek: any; getOllama?: any; getLmStudio?: any; isOllamaAvailable?: any; isLmStudioAvailable?: any },
  __dirname: string,
) {
  const gaeaMcp = createGaeaMcpServer(llm, toolRegistry, (event, data) => io.emit(event, data));

  app.get('/mcp/sse', requireAuth, (req, res) => handleMcpSSE(gaeaMcp, req, res));
  app.post('/mcp/message', requireAuth, (req, res) => handleMcpMessage(req, res));

  attachMcpWebSocket(server, async (transport) => {
    try {
      await gaeaMcp.connect(transport);
      console.log(`[MCP Server] WebSocket client connected: ${transport.sessionId}`);
    } catch (err: any) {
      console.error(`[MCP Server] WebSocket connection error:`, err.message);
    }
  });

  console.log('[MCP Server] Gaea MCP server ready at /mcp/sse + /mcp/ws');

  attachLAPWebSocket(server);
  console.log('[LAP] Agent protocol ready at /lap');

  // Connect to remote devices
  const mcpConfigPath = path.join(__dirname, 'mcp', 'config.json');
  if (fs.existsSync(mcpConfigPath)) {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
    if (mcpConfig.remoteDevices) {
      for (const [name, url] of Object.entries(mcpConfig.remoteDevices)) {
        console.log(`[MCP Server] Connecting to remote device: ${name}`);
        connectMcpServerToRemote(
          url as string, gaeaMcp, name as string,
          () => { deviceRegistry.registerMcpDevice(name as string, 'mcp_remote', { audio: true, video: false, spatial: false, haptic: false, holographic: false }); },
          () => { deviceRegistry.unregisterMcpDevice(name as string); },
        );
      }
    }
  }
}
