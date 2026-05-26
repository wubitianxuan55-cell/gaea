import { randomUUID } from 'crypto';
import type {
  LAPTask,
  LAPTaskDelegateRequest,
  LAPTaskDelegateResponse,
  LAPTaskResultRequest,
  LAPTaskResultResponse,
  LAPTaskStatus,
  LAPSession,
} from './types';

interface TaskRecord {
  task: LAPTask;
  sessionId: string;
  from: string;      // delegator agentId
  to: string;        // delegate agentId
  status: LAPTaskStatus;
  createdAt: string;
  updatedAt: string;
  result?: Record<string, any>;
  error?: string;
}

const tasks: Map<string, TaskRecord> = new Map();

export function delegateTask(
  request: LAPTaskDelegateRequest,
  session: LAPSession,
): LAPTaskDelegateResponse {
  const { task } = request;

  // Validate task
  if (!task.type || !task.taskId) {
    return { accepted: false, taskId: task.taskId || '', reason: 'Task requires type and taskId' };
  }

  // Check delegation is within session scope
  if (!session.scope.includes('delegate_task')) {
    return { accepted: false, taskId: task.taskId, reason: 'Session does not permit task delegation' };
  }

  // Check deadline
  if (task.deadline) {
    const deadlineMs = new Date(task.deadline).getTime();
    if (deadlineMs < Date.now()) {
      return { accepted: false, taskId: task.taskId, reason: 'Task deadline is in the past' };
    }
  }

  const record: TaskRecord = {
    task,
    sessionId: session.sessionId,
    from: session.peerA.agentId,
    to: session.peerB.agentId,
    status: 'accepted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.set(task.taskId, record);

  return {
    accepted: true,
    taskId: task.taskId,
    estimatedCompletion: task.type === 'code_review' ? '~5min' : task.type === 'web_search' ? '~30s' : undefined,
  };
}

export function updateTaskStatus(
  taskId: string,
  status: LAPTaskStatus,
  output?: Record<string, any>,
  error?: string,
): boolean {
  const record = tasks.get(taskId);
  if (!record) return false;
  record.status = status;
  record.updatedAt = new Date().toISOString();
  if (output) record.result = output;
  if (error) record.error = error;
  return true;
}

export function getTask(taskId: string): TaskRecord | undefined {
  return tasks.get(taskId);
}

export function getTasksForSession(sessionId: string): TaskRecord[] {
  return Array.from(tasks.values()).filter(t => t.sessionId === sessionId);
}

export function getTasksForAgent(agentId: string): TaskRecord[] {
  return Array.from(tasks.values()).filter(t => t.from === agentId || t.to === agentId);
}

export function cancelTasksForSession(sessionId: string): number {
  let count = 0;
  for (const [id, record] of tasks) {
    if (record.sessionId === sessionId && record.status !== 'completed' && record.status !== 'failed') {
      record.status = 'failed';
      record.error = 'Session revoked';
      count++;
    }
  }
  return count;
}

export function buildTaskListResponse(tasks: TaskRecord[]): Record<string, any> {
  return {
    tasks: tasks.map(r => ({
      taskId: r.task.taskId,
      type: r.task.type,
      status: r.status,
      from: r.from,
      to: r.to,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      hasResult: !!r.result,
    })),
    summary: {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending' || t.status === 'accepted').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    },
  };
}
