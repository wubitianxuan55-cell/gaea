import { ParsedToolCall, NormalizedLLMResponse } from '../tools/types';
import { withCloudResilience } from '../cloud/resilience';
import { isStrictPrivacy, requireLocalProvider } from '../config/privacy';

export type MessageContent =
  | string
  | null
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }>;

export interface NormalizedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: MessageContent;
  toolCalls?: ParsedToolCall[];
  toolCallId?: string;
  name?: string;
  reasoningContent?: string | null;
}

interface ToolDeclaration {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

// ── DeepSeek (OpenAI-compatible) ──

export function formatDeepSeekRequest(params: {
  model: string;
  messages: NormalizedMessage[];
  toolDeclarations: ToolDeclaration[];
  maxTokens?: number;
  userId?: string;
}): {
  model: string;
  messages: Array<{ role: string; content: MessageContent; tool_calls?: any; tool_call_id?: string }>;
  tools?: ToolDeclaration[];
  tool_choice?: string;
  max_tokens?: number;
  user?: string;
} {
  const openaiMessages = params.messages.map(m => {
    const roleMap: Record<string, string> = { assistant: 'assistant', tool: 'tool', system: 'system' };
    const entry: any = { role: roleMap[m.role] || 'user' };
    if (m.content !== null) entry.content = m.content;
    if (m.reasoningContent) entry.reasoning_content = m.reasoningContent;
    if (m.toolCalls) {
      entry.tool_calls = m.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }));
    }
    if (m.toolCallId) entry.tool_call_id = m.toolCallId;
    if (m.name) entry.name = m.name;
    return entry;
  });

  const hasTools = params.toolDeclarations.length > 0;

  return {
    model: params.model,
    messages: openaiMessages,
    ...(hasTools ? { tools: params.toolDeclarations, tool_choice: 'auto' } : {}),
    ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
    ...(params.userId ? { user: params.userId.replace(/[^a-zA-Z0-9_-]/g, '_') } : {}),
  };
}

function extractUsage(rawResponse: any) {
  const usage = rawResponse.usage || rawResponse.usageMetadata;
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens || usage.promptTokenCount || usage.input_tokens || usage.inputTokens || 0,
    completionTokens: usage.completion_tokens || usage.candidatesTokenCount || usage.output_tokens || usage.outputTokens || 0,
    totalTokens: usage.total_tokens || usage.totalTokenCount || 0,
  };
}

export function parseDeepSeekResponse(rawResponse: any): NormalizedLLMResponse {
  const message = rawResponse.choices?.[0]?.message;
  if (!message) return { text: null, toolCalls: null };

  // Reasoning models (v4-pro, v4-flash, reasoner) put output in reasoning_content; content may be empty
  const text = message.content || message.reasoning_content || null;
  const reasoningContent = message.reasoning_content || null;
  const usage = extractUsage(rawResponse);

  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCalls: ParsedToolCall[] = message.tool_calls.map((tc: any) => {
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(tc.function?.arguments || '{}');
      } catch { /* ignore parse errors */ }
      return { id: tc.id, name: tc.function?.name || '', arguments: args };
    });
    return { text, toolCalls, reasoningContent, usage };
  }

  return { text, toolCalls: null, reasoningContent, usage };
}

// ── LLM Call Router ──

export async function makeLLMCall(
  messages: NormalizedMessage[],
  toolDeclarations: ToolDeclaration[],
  config: { provider: string; model: string; maxTokens?: number; userId?: string },
  getDeepSeek: () => any,
  _getGemini?: () => any,
  _getOpenAI?: () => any,
  _getAnthropic?: () => any,
  _getQwen?: () => any,
  getOllama?: () => any,
  getLmStudio?: () => any,
  _getArk?: () => any,
  _getXiaomi?: () => any,
  _getKimi?: () => any,
  _getGlm?: () => any,
  _getRelay?: () => any,
): Promise<NormalizedLLMResponse> {
  // ── Privacy gate: strict mode blocks cloud providers ──
  // Reasoning models need high token budget — their CoT eats into max_tokens
  const maxTokens = isReasoningModel(config.model)
    ? Math.max(config.maxTokens || 8000, 4000)
    : config.maxTokens;

  if (isStrictPrivacy()) {
    if (config.provider === 'auto') {
      // In strict mode, auto routes to local-only dispatch
      if (getOllama?.()) {
        try {
          const req = formatDeepSeekRequest({ model: 'llama3.2', messages, toolDeclarations, maxTokens: maxTokens, userId: config.userId });
          const client = getOllama();
          const res = await withCloudResilience(
            () => client.chat.completions.create(req),
            { provider: 'ollama', maxRetries: 1 }
          );
          return parseDeepSeekResponse(res);
        } catch {
          if (getLmStudio?.()) {
            try {
              const req = formatDeepSeekRequest({ model: config.model, messages, toolDeclarations, maxTokens: maxTokens, userId: config.userId });
              const client = getLmStudio();
              const res = await client.chat.completions.create(req);
              return parseDeepSeekResponse(res);
            } catch {}
          }
          throw new Error('[Privacy] Strict mode: no local LLM available. Start Ollama or LM Studio.');
        }
      }
      if (getLmStudio?.()) {
        const req = formatDeepSeekRequest({ model: config.model, messages, toolDeclarations, maxTokens: maxTokens, userId: config.userId });
        const client = getLmStudio();
        const res = await client.chat.completions.create(req);
        return parseDeepSeekResponse(res);
      }
      throw new Error('[Privacy] Strict mode: no local LLM provider available. Set up Ollama or LM Studio.');
    }
    requireLocalProvider(config.provider);
  }

  // ── Auto/hybrid dispatch: local Ollama → cloud DeepSeek fallback ──
  if (config.provider === 'auto' && getOllama) {
    const { dispatchLLMCall } = await import('./dispatch');
    const getters = { getDeepSeek, getOllama, isOllamaAvailable: () => !!getOllama?.(), getLmStudio, isLmStudioAvailable: () => !!getLmStudio?.() };
    const result = await dispatchLLMCall(messages, toolDeclarations, { provider: 'deepseek', model: 'deepseek-chat', maxTokens: maxTokens, userId: config.userId }, getters);
    return { text: result.text, toolCalls: result.toolCalls, usage: result.usage };
  }

  // OpenAI-compatible path: DeepSeek, Ollama, LM Studio
  if (config.provider === 'deepseek' || config.provider === 'ollama' || config.provider === 'lmstudio') {
    const client = config.provider === 'deepseek' ? getDeepSeek()
      : config.provider === 'lmstudio' ? getLmStudio?.()
      : getOllama?.();
    if (!client) throw new Error(`${config.provider} not configured`);

    const isLocal = config.provider === 'ollama' || config.provider === 'lmstudio';
    const params = formatDeepSeekRequest({
      model: config.model,
      messages,
      toolDeclarations,
      maxTokens: maxTokens,
      ...(isLocal ? {} : { userId: config.userId }),
    });

    const response = await withCloudResilience(
      () => client.chat.completions.create(params),
      { provider: config.provider, model: config.model },
    );
    return parseDeepSeekResponse(response);
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

// ── Streaming LLM Call Router ──

export type StreamCallback = (chunk: string) => void;

function isReasoningModel(model: string): boolean {
  return /reasoner|v4-(pro|flash)|o[13]|o4-mini|r1/i.test(model);
}

export async function makeLLMCallStreaming(
  messages: NormalizedMessage[],
  toolDeclarations: ToolDeclaration[],
  config: { provider: string; model: string; maxTokens?: number; userId?: string; signal?: AbortSignal },
  onChunk: StreamCallback,
  getDeepSeek: () => any,
  _getGemini?: () => any,
  _getOpenAI?: () => any,
  _getAnthropic?: () => any,
  _getQwen?: () => any,
  getOllama?: () => any,
  getLmStudio?: () => any,
  _getArk?: () => any,
  _getXiaomi?: () => any,
  _getKimi?: () => any,
  _getGlm?: () => any,
  _getRelay?: () => any,
): Promise<NormalizedLLMResponse> {
  // ── Privacy gate ──
  if (isStrictPrivacy() && config.provider !== 'auto') {
    requireLocalProvider(config.provider);
  }

  // Reasoning models need high token budget
  const maxTokens = isReasoningModel(config.model)
    ? Math.max(config.maxTokens || 8000, 4000)
    : config.maxTokens;

  // ── Auto/hybrid dispatch: local Ollama → cloud DeepSeek fallback ──
  if (config.provider === 'auto' && getOllama) {
    const { dispatchLLMCallStreaming } = await import('./dispatch');
    const getters = { getDeepSeek, getOllama, isOllamaAvailable: () => !!getOllama?.(), getLmStudio, isLmStudioAvailable: () => !!getLmStudio?.() };
    const result = await dispatchLLMCallStreaming(messages, toolDeclarations, { provider: 'deepseek', model: 'deepseek-chat', maxTokens: maxTokens, userId: config.userId, signal: config.signal }, onChunk, getters);
    return { text: result.text, toolCalls: result.toolCalls, usage: result.usage };
  }

  // ── DeepSeek / Ollama / LM Studio (OpenAI-compatible streaming) ──
  if (config.provider === 'deepseek' || config.provider === 'ollama' || config.provider === 'lmstudio') {
    const client = config.provider === 'deepseek' ? getDeepSeek()
      : config.provider === 'lmstudio' ? getLmStudio?.()
      : getOllama?.();
    if (!client) throw new Error(`${config.provider} not configured`);

    const isLocal = config.provider === 'ollama' || config.provider === 'lmstudio';
    const params: any = formatDeepSeekRequest({
      model: config.model,
      messages,
      toolDeclarations,
      maxTokens: maxTokens,
      ...(isLocal ? {} : { userId: config.userId }),
    });
    params.stream = true;

    const stream: any = await withCloudResilience(
      () => client.chat.completions.create(params, { signal: config.signal }),
      { provider: config.provider, model: config.model },
    );
    const accumulatedText: string[] = [];
    const accumulatedReasoning: string[] = [];
    const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map();
    let streamUsage: any = undefined;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta) {
        if (delta.content) {
          accumulatedText.push(delta.content);
          onChunk(delta.content);
        }

        if (delta.reasoning_content) {
          accumulatedReasoning.push(delta.reasoning_content);
          // Reasoning model → stream thinking as visible output when content is empty
          if (!delta.content) onChunk(delta.reasoning_content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallAccumulators.has(idx)) {
              toolCallAccumulators.set(idx, { id: tc.id || '', name: tc.function?.name || '', args: '' });
            }
            const acc = toolCallAccumulators.get(idx)!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
          }
        }
      }
      if (chunk.usage) streamUsage = chunk.usage;
    }

    const usage = extractUsage({ usage: streamUsage });

    const text = accumulatedText.length > 0 ? accumulatedText.join('') : (accumulatedReasoning.length > 0 ? accumulatedReasoning.join('') : null);
    const reasoningContent = accumulatedReasoning.length > 0 ? accumulatedReasoning.join('') : null;
    if (toolCallAccumulators.size > 0) {
      const toolCalls: ParsedToolCall[] = [...toolCallAccumulators.values()].map(acc => {
        let args: Record<string, any> = {};
        try { args = JSON.parse(acc.args || '{}'); } catch { /* ignore parse errors */ }
        return { id: acc.id, name: acc.name, arguments: args };
      });
      return { text, toolCalls, reasoningContent, usage };
    }
    return { text, toolCalls: null, reasoningContent, usage };
  }

  throw new Error(`Unsupported streaming provider: ${config.provider}`);
}

// ── Token estimation ──────────────────────────────────────────────────────

/**
 * Quick token count heuristic.
 * English: ~4 chars/token. CJK: ~1.5 chars/token.
 * Fallback: 3 chars/token for mixed content.
 */
export function estimateTokenCount(text: string): number {
  let cjk = 0;
  let ascii = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) {
      cjk++;
    } else if (code < 0x80) {
      ascii++;
    } else {
      // Punctuation, emoji, etc — count as 1 token each
      cjk++;
    }
  }
  return Math.ceil(ascii / 4 + cjk / 1.5);
}
