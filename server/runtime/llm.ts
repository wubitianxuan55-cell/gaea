import OpenAI from "openai";
import { getKey } from "../config/keys";
import { readDB } from "../../db_layer";

let deepseek: OpenAI | null = null;
let ollama: OpenAI | null = null;
let ollamaDetected = false;
let lmstudio: OpenAI | null = null;
let lmstudioDetected = false;

/** Read Ollama base URL from settings (user-configured) or env var */
function getOllamaBaseUrl(): string {
  try {
    const db = readDB();
    const setting = (db.settings || []).find((s: any) => s.key === 'ollama_config');
    if (setting) {
      const config = JSON.parse(setting.value);
      if (config.baseUrl) return config.baseUrl.replace(/\/+$/, '');
    }
  } catch { /* DB not initialized yet — use env */ }
  return (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
}

/** Read LM Studio base URL from settings (user-configured) or env var */
function getLmStudioBaseUrl(): string {
  try {
    const db = readDB();
    const setting = (db.settings || []).find((s: any) => s.key === 'lmstudio_config');
    if (setting) {
      const config = JSON.parse(setting.value);
      if (config.baseUrl) return config.baseUrl.replace(/\/+$/, '');
    }
  } catch { /* DB not initialized yet — use env */ }
  return (process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234').replace(/\/+$/, '');
}

export interface LLMClients {
  getDeepSeek: () => OpenAI | null;
  getOllama: () => OpenAI | null;
  isOllamaAvailable: () => boolean;
  getLmStudio: () => OpenAI | null;
  isLmStudioAvailable: () => boolean;
}

function getDeepSeek() {
  const envKey = process.env.DEEPSEEK_API_KEY;
  const storedKey = getKey('DEEPSEEK_API_KEY');
  const key = envKey || storedKey;
  if (!deepseek && key) {
    deepseek = new OpenAI({
      apiKey: key,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    });
  }
  return deepseek;
}

// Backward-compatible: removed cloud providers (DeepSeek-only)

function getOllama() {
  if (!ollama && ollamaDetected) {
    const url = getOllamaBaseUrl();
    ollama = new OpenAI({
      apiKey: 'ollama',
      baseURL: `${url}/v1`,
    });
  }
  return ollama;
}

function isOllamaAvailable() {
  return ollamaDetected;
}

async function detectOllama(): Promise<boolean> {
  try {
    const baseUrl = getOllamaBaseUrl();
    const resp = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      const models = data.models || [];
      const hasLLM = models.some((m: any) =>
        !m.name.includes('embed') && !m.name.includes('whisper')
      );
      ollamaDetected = hasLLM;
      console.log(`[LLM] Ollama detected — ${models.length} models (${hasLLM ? 'LLM available' : 'no LLM models found'})`);
      return hasLLM;
    }
  } catch {
    // Ollama not running — expected on most machines
  }
  ollamaDetected = false;
  return false;
}

function getLmStudio() {
  if (!lmstudio && lmstudioDetected) {
    const url = getLmStudioBaseUrl();
    lmstudio = new OpenAI({
      apiKey: 'lm-studio',
      baseURL: `${url}/v1`,
    });
  }
  return lmstudio;
}

function isLmStudioAvailable() {
  return lmstudioDetected;
}

async function detectLmStudio(): Promise<boolean> {
  try {
    const baseUrl = getLmStudioBaseUrl();
    const resp = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      const models = data.data || [];
      const hasLLM = models.length > 0;
      lmstudioDetected = hasLLM;
      console.log(`[LLM] LM Studio detected — ${models.length} models`);
      return hasLLM;
    }
  } catch { /* LM Studio not running */ }
  lmstudioDetected = false;
  return false;
}

export function createLLMRuntime(): LLMClients {
  // Fire-and-forget: detect local Ollama and LM Studio in background
  detectOllama();
  detectLmStudio();
  return { getDeepSeek, getOllama, isOllamaAvailable, getLmStudio, isLmStudioAvailable };
}
