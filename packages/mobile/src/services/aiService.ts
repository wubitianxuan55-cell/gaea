export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  text: string;
  error?: string;
}

export async function callAI(provider: string, model: string, prompt: string, messages?: ChatMessage[], apiKey?: string): Promise<AIResponse> {
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "", // Optional proprietary key
      },
      body: JSON.stringify({ provider, model, prompt, messages }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch AI response");
    }

    return await response.json();
  } catch (error: any) {
    console.error("AI Service Error:", error);
    return { text: "", error: error.message };
  }
}
