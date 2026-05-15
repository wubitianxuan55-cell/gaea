import { ToolRegistry } from '../registry';
import { saveWorkflow, listWorkflows, getWorkflow, deleteWorkflow } from '../../agents/workflows';

async function handleSaveWorkflow(args: Record<string, any>, context?: any): Promise<string> {
  const userId = context?.userId || 'system';
  const name: string = args.name || '';
  const description: string = args.description || '';
  const steps = args.steps || [];

  if (!name) throw new Error('Workflow name is required');
  if (!steps.length) throw new Error('At least one step is required');

  const wf = saveWorkflow(userId, name, description, steps, undefined, args.category);
  return `Workflow "${wf.name}" saved with ${wf.steps.length} steps.`;
}

async function handleListWorkflows(_args: Record<string, any>, context?: any): Promise<string> {
  const userId = context?.userId || 'system';
  const workflows = listWorkflows(userId);
  if (!workflows.length) return 'No saved workflows.';
  return workflows.map(w =>
    `- **${w.name}**: ${w.description || 'No description'} (${w.steps.length} steps, run ${w.runCount} times)`
  ).join('\n');
}

async function handleGetWorkflow(args: Record<string, any>, context?: any): Promise<string> {
  const userId = context?.userId || 'system';
  const name: string = args.name || '';
  const wf = getWorkflow(userId, name);
  if (!wf) throw new Error(`Workflow "${name}" not found`);
  const steps = wf.steps.map((s, i) => `  ${i + 1}. ${s.description}`).join('\n');
  return `**${wf.name}** — ${wf.description}\n\nSteps:\n${steps}\n\nRun count: ${wf.runCount}`;
}

async function handleDeleteWorkflow(args: Record<string, any>, context?: any): Promise<string> {
  const userId = context?.userId || 'system';
  const name: string = args.name || '';
  const ok = deleteWorkflow(userId, name);
  return ok ? `Deleted workflow "${name}"` : `Workflow "${name}" not found`;
}

export function registerWorkflowTools(registry: ToolRegistry): void {
  registry.register({
    name: 'save_workflow',
    description: 'Save a named multi-step workflow that can be recalled and run later. Use this when the user says "remember this workflow" or wants to save a useful process pattern.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Unique name for this workflow (e.g., "morning routine")' },
        description: { type: 'string', description: 'Short description of what this workflow does' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              tool: { type: 'string' },
              args: { type: 'object' },
            },
          },
          description: 'Ordered list of workflow steps',
        },
        category: { type: 'string', description: 'Optional category for grouping' },
      },
      required: ['name', 'steps'],
    },
    handler: handleSaveWorkflow,
    permission: 'user',
    securityLevel: 'safe',
  });

  registry.register({
    name: 'list_workflows',
    description: 'List all saved named workflows for the current user.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: handleListWorkflows,
    permission: 'user',
    securityLevel: 'safe',
  });

  registry.register({
    name: 'get_workflow',
    description: 'Get the full details of a saved workflow by name.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name' },
      },
      required: ['name'],
    },
    handler: handleGetWorkflow,
    permission: 'user',
    securityLevel: 'safe',
  });

  registry.register({
    name: 'delete_workflow',
    description: 'Delete a saved workflow by name.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name to delete' },
      },
      required: ['name'],
    },
    handler: handleDeleteWorkflow,
    permission: 'user',
    securityLevel: 'confirm',
  });
}
