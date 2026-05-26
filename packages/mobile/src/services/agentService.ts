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
    You are the LumiAI Core acting on the ${context.platform} platform.
    If platform is 'electron', you have access to local file systems and system automation.
    If platform is 'web', you are a lightweight assistant restricted to a browser sandbox.
    
    Respond in a technical, futuristic, and helpful tone.
  `;

  try {
    // If the user provided a custom key and it's gemini, we could use it locally
    // but for now, we'll route everything through the server proxy callAI
    // which can also handle other providers like OpenAI/DeepSeek
    const response = await callAI(provider, model, prompt, [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ], apiKey);

    if (response.error) throw new Error(response.error);
    
    return {
      text: response.text,
      capabilities: context.platform === 'electron' 
        ? ["File System", "System Automation", "P2P Sync", "Neural Core"]
        : ["Cloud Sync", "Web Perception"],
      actions: context.platform === 'electron' ? ["AUTO_INDEX_FILES", "NOTIFY_SYSTEM"] : ["SYNC_CLOUD"]
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
