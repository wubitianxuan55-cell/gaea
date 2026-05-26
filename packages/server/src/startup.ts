import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, ChildProcess } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { Server } from "socket.io";
import http from "http";
import bcrypt from "bcryptjs";
import { readDB, writeDB, ensureDatabaseInitialized } from "./data/db_layer";
import { personalityRegistry } from "./personality";
import { deviceRegistry } from "./devices";
import { toolRegistry } from "./tools/registry";
import { registerAllTools } from "./tools/definitions/index";
import { mcpManager, registerMCPTools } from "./mcp";
import { scheduler, registerScheduledTasks } from "./scheduler";
import { initMemorySync, initMemoryAssociations } from "./memory";
import { setOnAgentPromoted } from "./agents/orchestrator";

export interface StartupDeps {
  llmGetters: {
    getDeepSeek: () => any;
    getGemini: () => any;
    getOpenAI: () => any;
    getAnthropic: () => any;
    getQwen: () => any;
  };
}

export async function bootstrap(io: Server, deps: StartupDeps) {
  const { llmGetters } = deps;

  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    process.exit(1);
  }

  try {
    await ensureDatabaseInitialized();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  // Auto-create admin account for local development continuity
  const adminPassword = process.env.AUTO_LOGIN_PASSWORD;
  if (adminPassword) {
    try {
      const db = readDB();
      const adminExists = db.users.find((u: any) => u.username === 'admin');
      if (!adminExists) {
        db.users.push({
          uid: Math.random().toString(36).substring(2, 15),
          username: 'admin',
          password: await bcrypt.hash(adminPassword, 10),
          phone: '+00000000000',
          role: 'admin',
          balance: 999.0,
          createdAt: new Date().toISOString(),
        });
        writeDB(db);
        console.log('[Bootstrap] Admin account created');
      }
    } catch (err) {
      console.warn('[Bootstrap] Failed to ensure admin account:', (err as Error).message);
    }
  }

  // Register all agent tools
  registerAllTools(toolRegistry, llmGetters);
  console.log(`[Tools] Registered ${toolRegistry.list().length} built-in tools`);

  // Register MCP tools (non-blocking)
  registerMCPTools(io).then(mcpTools => {
    if (mcpTools.length > 0) {
      console.log(`[MCP] Registered ${mcpTools.length} MCP tools (total: ${toolRegistry.list().length})`);
    }
  }).catch(err => {
    console.warn('[MCP] Tool registration warning:', err.message);
  });

  // Personalities setup
  personalityRegistry.load();
  personalityRegistry.setBroadcast((event, data) => { io.emit(event, data); });
  deviceRegistry.setBroadcast((event, data) => { io.emit(event, data); });

  // Agent promotion notifications via socket.io
  setOnAgentPromoted((agent) => {
    io.emit('agent:promoted', {
      id: agent.id,
      name: agent.name,
      skillTags: agent.skillTags,
      autoCreated: true,
    });
  });

  // Memory sync
  initMemorySync(io);
  initMemoryAssociations();

  // Scheduler
  scheduler.setIO(io);
  registerScheduledTasks(llmGetters.getDeepSeek, llmGetters.getGemini, llmGetters.getOpenAI, llmGetters.getAnthropic, llmGetters.getQwen);

  // GPT-SoVITS API server (optional)
  let gptSovitsProcess: ChildProcess | null = null;
  // Try multiple locations: repo root (dev), package root (bundled)
  let gptSovitsDir = path.join(__dirname, '..', '..', '..', 'gpt-sovits-src');
  if (!fs.existsSync(path.join(gptSovitsDir, 'api_v2.py'))) {
    gptSovitsDir = path.join(process.cwd(), 'gpt-sovits-src');
  }
  const pythonExe = path.join(gptSovitsDir, 'venv/Scripts/python.exe');
  const apiPy = path.join(gptSovitsDir, 'api_v2.py');
  if (fs.existsSync(pythonExe) && fs.existsSync(apiPy)) {
    console.log('[GPT-SoVITS] Starting API server...');
    gptSovitsProcess = spawn(pythonExe, [
      apiPy, '-a', '127.0.0.1', '-p', '9880', '-c', 'GPT_SoVITS/configs/tts_infer.yaml',
    ], { cwd: gptSovitsDir, stdio: 'pipe' });
    gptSovitsProcess.stdout?.on('data', (d: Buffer) => {
      const line = d.toString().trim();
      if (line) console.log(`[GPT-SoVITS] ${line}`);
    });
    gptSovitsProcess.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim();
      if (line) console.warn(`[GPT-SoVITS] ${line}`);
    });
    gptSovitsProcess.on('error', (err) => {
      console.warn('[GPT-SoVITS] Process error:', err.message);
      gptSovitsProcess = null;
    });
    gptSovitsProcess.on('exit', (code) => {
      if (code && code !== 0) console.warn(`[GPT-SoVITS] Exited with code ${code}`);
      gptSovitsProcess = null;
    });
  } else {
    console.log('[GPT-SoVITS] Not found — TTS will use cloud providers only.');
  }

  // Cleanup on exit
  const cleanup = async () => {
    console.log('[Shutdown] Cleaning up...');
    try {
      await mcpManager.disconnectAll();
      console.log('[MCP] All servers disconnected');
    } catch (err: any) {
      console.warn('[MCP] Disconnect error:', err.message);
    }
    if (gptSovitsProcess && !gptSovitsProcess.killed) {
      console.log('[GPT-SoVITS] Stopping API server...');
      gptSovitsProcess.kill();
    }
    process.exit(0);
  };
  process.on('SIGINT', () => { cleanup(); });
  process.on('SIGTERM', () => { cleanup(); });

  return { gptSovitsProcess };
}
