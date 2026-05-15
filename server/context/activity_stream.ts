/**
 * Continuous Activity Stream — tracks ambient user activity events.
 *
 * Events are pushed from the Tauri frontend via poll_activity and from
 * the clipboard monitor. The stream feeds proactive triggers.
 */

export type ActivityEventType =
  | 'window_changed'
  | 'clipboard_changed'
  | 'user_idle_start'
  | 'user_idle_end';

export interface ActivityEvent {
  type: ActivityEventType;
  timestamp: string;
  data?: Record<string, any>;
}

const MAX_EVENTS = 100;
const activityBuffers = new Map<string, ActivityEvent[]>();

export function pushActivityEvent(userId: string, event: ActivityEvent): void {
  if (!activityBuffers.has(userId)) {
    activityBuffers.set(userId, []);
  }
  const buffer = activityBuffers.get(userId)!;
  buffer.push(event);
  if (buffer.length > MAX_EVENTS) {
    buffer.shift();
  }
}

export function getRecentActivity(userId: string, limit = 20): ActivityEvent[] {
  const buffer = activityBuffers.get(userId) || [];
  return buffer.slice(-limit);
}

export function getLastEvent(userId: string, type?: ActivityEventType): ActivityEvent | null {
  const buffer = activityBuffers.get(userId) || [];
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (!type || buffer[i].type === type) return buffer[i];
  }
  return null;
}

/** Track per-user state machine for idle transitions */
const idleState = new Map<string, { isIdle: boolean; idleSince?: string }>();

export function getIdleState(userId: string): { isIdle: boolean; idleSince?: string } {
  return idleState.get(userId) || { isIdle: false };
}

export function setIdleState(userId: string, isIdle: boolean): void {
  const prev = idleState.get(userId);
  if (prev?.isIdle !== isIdle) {
    idleState.set(userId, {
      isIdle,
      idleSince: isIdle ? new Date().toISOString() : undefined,
    });
    pushActivityEvent(userId, {
      type: isIdle ? 'user_idle_start' : 'user_idle_end',
      timestamp: new Date().toISOString(),
    });
  }
}
