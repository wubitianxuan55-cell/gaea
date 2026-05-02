export type ToolPermission = 'public' | 'user' | 'admin' | 'system';

export interface ToolContext {
  userId?: string;
  socketId?: string;
  cwd?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (args: Record<string, any>, context?: ToolContext) => Promise<string>;
  permission: ToolPermission;
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface NormalizedLLMResponse {
  text: string | null;
  toolCalls: ParsedToolCall[] | null;
}

export interface ToolExecutionRecord {
  name: string;
  arguments: Record<string, any>;
  result: string;
  error?: string;
}
