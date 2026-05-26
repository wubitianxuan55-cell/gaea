import type OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";
import type { GoogleGenerativeAI } from "@google/generative-ai";

export interface LLMGetters {
  getDeepSeek: () => OpenAI | null;
  getGemini: () => GoogleGenerativeAI | null;
  getOpenAI: () => OpenAI | null;
  getAnthropic: () => Anthropic | null;
  getQwen: () => OpenAI | null;
}

export interface SocketDeps {
  jwtSecret: string;
  deviceRegistry: {
    register: (uid: string, socketId: string, info: any) => void;
    disconnect: (socketId: string) => void;
    getUserDevices: (uid: string) => any[];
    registerMcpDevice?: (name: string, type: string, caps: any) => void;
    unregisterMcpDevice?: (name: string) => void;
  };
  llmGetters: LLMGetters;
  registerUserSocket: (uid: string, socketId: string) => void;
  unregisterUserSocket: (socketId: string) => void;
}
