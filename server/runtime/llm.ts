import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getKey } from "../config/keys";

let openai: OpenAI | null = null;
let anthropic: Anthropic | null = null;
let gemini: GoogleGenerativeAI | null = null;
let deepseek: OpenAI | null = null;
let qwen: OpenAI | null = null;
let ark: OpenAI | null = null;
let ollama: OpenAI | null = null;
let ollamaDetected = false;

export interface LLMClients {
  getOpenAI: () => OpenAI | null;
  getAnthropic: () => Anthropic | null;
  getGemini: () => GoogleGenerativeAI | null;
  getDeepSeek: () => OpenAI | null;
  getQwen: () => OpenAI | null;
  getArk: () => OpenAI | null;
  getOllama: () => OpenAI | null;
  isOllamaAvailable: () => boolean;
}

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY || getKey('OPENAI_API_KEY');
  if (!openai && key) {
    openai = new OpenAI({ apiKey: key });
  }
  return openai;
}

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY || getKey('ANTHROPIC_API_KEY');
  if (!anthropic && key) {
    anthropic = new Anthropic({ apiKey: key });
  }
  return anthropic;
}

function getGemini() {
  if (!gemini) {
    const key = process.env.GEMINI_API_KEY || getKey('GEMINI_API_KEY');
    if (!key) return null;
    gemini = new GoogleGenerativeAI(key);
  }
  return gemini;
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

function getQwen() {
  const key = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY
    || getKey('QWEN_API_KEY') || getKey('DASHSCOPE_API_KEY');
  if (!qwen && key) {
    qwen = new OpenAI({ apiKey: key, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" });
  }
  return qwen;
}

function getArk() {
  const key = process.env.ARK_API_KEY || getKey('ARK_API_KEY');
  if (!ark && key) {
    ark = new OpenAI({
      apiKey: key,
      baseURL: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
    });
  }
  return ark;
}

function getOllama() {
  if (!ollama && ollamaDetected) {
    ollama = new OpenAI({
      apiKey: 'ollama', // Ollama doesn't require an API key but the SDK requires non-empty
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    });
  }
  return ollama;
}

function isOllamaAvailable() {
  return ollamaDetected;
}

async function detectOllama(): Promise<boolean> {
  try {
    const resp = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`, {
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

export function createLLMRuntime(): LLMClients {
  // Fire-and-forget: detect local Ollama in background
  detectOllama();
  return { getOpenAI, getAnthropic, getGemini, getDeepSeek, getQwen, getArk, getOllama, isOllamaAvailable };
}
