import type {
  LAPContextShareRequest,
  LAPContextShareResponse,
  LAPContextEntry,
  LAPContextScope,
  LAPSession,
} from './types';

interface SharedContextRecord {
  id: string;
  sessionId: string;
  fromAgentId: string;
  toAgentId: string;
  entry: LAPContextEntry;
  sharedAt: string;
  expiresAt?: string;
}

const sharedContexts: Map<string, SharedContextRecord[]> = new Map(); // sessionId → records

export function shareContext(
  request: LAPContextShareRequest,
  session: LAPSession,
): LAPContextShareResponse {
  if (!session.scope.includes('share_context')) {
    return { accepted: false, acceptedEntries: 0, rejectedEntries: request.contexts.length, reason: 'Session does not permit context sharing' };
  }

  let accepted = 0;
  let rejected = 0;

  for (const entry of request.contexts) {
    if (!entry.payload || entry.confidence < 0) {
      rejected++;
      continue;
    }

    const record: SharedContextRecord = {
      id: `${session.sessionId}_ctx_${accepted}_${Date.now()}`,
      sessionId: session.sessionId,
      fromAgentId: session.peerA.agentId,
      toAgentId: session.peerB.agentId,
      entry,
      sharedAt: new Date().toISOString(),
    };

    if (entry.scope === 'one-time') {
      // Single-use — expires in 5 min
      record.expiresAt = new Date(Date.now() + 300_000).toISOString();
    } else if (entry.scope === 'session') {
      // Co-lives with session
      record.expiresAt = undefined;
    } else if (entry.scope === 'permanent') {
      // Stays until explicitly revoked
      record.expiresAt = undefined;
    }

    if (!sharedContexts.has(session.sessionId)) {
      sharedContexts.set(session.sessionId, []);
    }
    sharedContexts.get(session.sessionId)!.push(record);
    accepted++;
  }

  return { accepted: true, acceptedEntries: accepted, rejectedEntries: rejected };
}

export function getSharedContexts(sessionId: string): SharedContextRecord[] {
  return sharedContexts.get(sessionId) || [];
}

export function getActiveSharedContexts(sessionId: string): SharedContextRecord[] {
  const records = sharedContexts.get(sessionId) || [];
  const now = new Date().toISOString();
  return records.filter(r => !r.expiresAt || r.expiresAt > now);
}

export function removeSharedContexts(sessionId: string): number {
  const count = (sharedContexts.get(sessionId) || []).length;
  sharedContexts.delete(sessionId);
  return count;
}
