import { callAI } from "./aiService";

export interface AgentResponse {
  text: string;
  actions?: string[];
  capabilities: string[];
}

export interface AIConfig {
  provider: string;
  model: string;
  apiKey?: string;
}

export async function runAgentLogic(prompt: string, context: { platform: string; aiConfig?: AIConfig }): Promise<AgentResponse> {
  const { provider = 'gemini', model = 'gemini-1.5-flash', apiKey } = context.aiConfig || {};

  const systemInstruction = `
    You are the LumiAI Core acting on a mobile platform.
    You are a mobile assistant with sensor access and on-device capabilities.

    Respond in a technical, futuristic, and helpful tone.
  `;

  try {
    const response = await callAI(provider, model, prompt, [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ], apiKey);

    if (response.error) throw new Error(response.error);

    return {
      text: response.text,
      capabilities: ["Mobile Sensors", "On-device AI", "Cloud Sync"],
      actions: ["SYNC_CLOUD"]
    };
  } catch (error: any) {
    console.error("Agent Error:", error);
    return {
      text: `Communication Failure: ${error.message}. Fallback to local mesh active.`,
      capabilities: ["Local Safe-mode"],
      actions: []
    };
  }
}
