/**
 * Named Workflow Persistence — user-named, recallable multi-step workflow definitions.
 *
 * Unlike the worklog (which auto-records tool traces for pattern detection),
 * named workflows are explicitly saved by the user or the system when a useful
 * pattern is discovered. They can be run by name: "run my morning routine".
 */
import { readDB, writeDB } from '../../db_layer';
import { SubTask } from './orchestrator';

export interface WorkflowDefinition {
  id: string;
  userId: string;
  name: string;
  description: string;
  steps: Array<{
    description: string;
    tool?: string;
    args?: Record<string, any>;
    requiredSkill?: string;
    executionMode?: string;
  }>;
  agentAssignments?: Record<string, string>; // subTaskId -> agentId
  category?: string;
  createdAt: string;
  lastRunAt?: string;
  runCount: number;
}

function genId(): string {
  return 'wflow_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
}

export function saveWorkflow(
  userId: string,
  name: string,
  description: string,
  steps: WorkflowDefinition['steps'],
  agentAssignments?: Record<string, string>,
  category?: string,
): WorkflowDefinition {
  const db = readDB();
  if (!db.workflows) db.workflows = [];

  // Upsert: if a workflow with same name exists for this user, update it
  const existing = db.workflows.find((w: WorkflowDefinition) => w.userId === userId && w.name === name);
  if (existing) {
    existing.description = description;
    existing.steps = steps;
    existing.agentAssignments = agentAssignments || existing.agentAssignments;
    existing.category = category || existing.category;
    writeDB(db);
    return existing;
  }

  const wf: WorkflowDefinition = {
    id: genId(),
    userId,
    name,
    description,
    steps,
    agentAssignments,
    category,
    createdAt: new Date().toISOString(),
    runCount: 0,
  };
  db.workflows.push(wf);
  writeDB(db);
  return wf;
}

export function listWorkflows(userId: string, category?: string): WorkflowDefinition[] {
  const db = readDB();
  if (!db.workflows) return [];
  return db.workflows
    .filter((w: WorkflowDefinition) => w.userId === userId && (!category || w.category === category))
    .sort((a: WorkflowDefinition, b: WorkflowDefinition) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getWorkflow(userId: string, name: string): WorkflowDefinition | null {
  const db = readDB();
  if (!db.workflows) return null;
  return db.workflows.find((w: WorkflowDefinition) => w.userId === userId && w.name === name) || null;
}

export function deleteWorkflow(userId: string, name: string): boolean {
  const db = readDB();
  if (!db.workflows) return false;
  const idx = db.workflows.findIndex((w: WorkflowDefinition) => w.userId === userId && w.name === name);
  if (idx < 0) return false;
  db.workflows.splice(idx, 1);
  writeDB(db);
  return true;
}

export function recordWorkflowRun(userId: string, name: string): void {
  const db = readDB();
  if (!db.workflows) return;
  const wf = db.workflows.find((w: WorkflowDefinition) => w.userId === userId && w.name === name);
  if (wf) {
    wf.lastRunAt = new Date().toISOString();
    wf.runCount++;
    writeDB(db);
  }
}

/**
 * Convert an orchestrator task decomposition into a named workflow.
 * Called when the user says "remember this" after a successful orchestration run.
 */
export function captureFromOrchestration(
  userId: string,
  name: string,
  taskDescription: string,
  subTasks: SubTask[],
  agentAssignments: Record<string, string>,
): WorkflowDefinition {
  const steps = subTasks.map(st => ({
    description: st.description,
    requiredSkill: st.requiredSkill,
    executionMode: st.executionMode,
  }));
  return saveWorkflow(userId, name, taskDescription, steps, agentAssignments);
}
