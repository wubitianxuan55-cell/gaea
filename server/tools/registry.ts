import { ToolDefinition, ToolPermission, ToolContext } from './types';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(filterPermission?: ToolPermission): ToolDefinition[] {
    const all = Array.from(this.tools.values());
    if (!filterPermission) return all;
    return all.filter(t => t.permission === filterPermission || t.permission === 'public');
  }

  getToolDeclarations(): Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, any> };
  }> {
    return this.list().map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async execute(name: string, args: Record<string, any>, context?: ToolContext): Promise<string> {
    const tool = this.get(name);
    if (!tool) throw new Error(`Tool "${name}" not found in registry`);
    return tool.handler(args, context);
  }
}

export const toolRegistry = new ToolRegistry();
