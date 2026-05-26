/**
 * LAP (Lumi Agent Protocol) — Agent-to-agent collaboration protocol.
 *
 * Layers:
 *   Application: handshake · delegate · share · negotiate · notify · revoke
 *   Session:     encryption · heartbeat · session resume
 *   Transport:   WebSocket (real-time) / HTTP (async)
 */

// ── Agent Identity ──

export interface LAPAgentIdentity {
  agentId: string;        // e.g. "agent_abc123"
  userId: string;         // e.g. "user_alice"
  name: string;           // human-readable, e.g. "Alice 的 Lumi"
  capabilities: string[]; // e.g. ["chat", "code", "search", "memory"]
  publicKey: string;      // ed25519 public key (hex)
}

// ── Session ──

export type LAPTrustLevel = 'direct' | 'delegated' | 'public';
export type LAPScope = 'share_context' | 'delegate_task' | 'negotiate' | 'notify';

export interface LAPSession {
  sessionId: string;       // UUID
  peerA: LAPAgentIdentity;
  peerB: LAPAgentIdentity;
  trustLevel: LAPTrustLevel;
  scope: LAPScope[];
  establishedAt: string;   // ISO timestamp
  lastHeartbeat: string;
}

// ── Messages (JSON-RPC 2.0 envelope) ──

export interface LAPMessage {
  lap: '2.0';
  id: string;              // correlation ID (UUID)
  sessionId: string;       // LAP session ID
  timestamp: string;       // ISO timestamp
}

// ── 1. Handshake ──

export interface LAPHandshakeRequest extends LAPMessage {
  method: 'lap.handshake';
  agent: LAPAgentIdentity;
  proposedScope: LAPScope[];
  nonce: string;           // random 32-byte hex
}

export interface LAPHandshakeResponse {
  accepted: boolean;
  reason?: string;
  sessionId: string;
  agent: LAPAgentIdentity;
  trustLevel: LAPTrustLevel;
  scope: LAPScope[];
}

// ── 2. Context Share ──

export type LAPContextScope = 'one-time' | 'session' | 'permanent';

export interface LAPContextEntry {
  type: 'memory' | 'preference' | 'capability' | 'knowledge';
  scope: LAPContextScope;
  payload: string;
  confidence: number;       // 0–1
}

export interface LAPContextShareRequest extends LAPMessage {
  method: 'lap.context.share';
  contexts: LAPContextEntry[];
}

export interface LAPContextShareResponse {
  accepted: boolean;
  acceptedEntries: number;
  rejectedEntries: number;
  reason?: string;
}

// ── 3. Task Delegation ──

export type LAPTaskStatus = 'pending' | 'accepted' | 'rejected' | 'running' | 'completed' | 'failed';
export type LAPTaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface LAPTask {
  taskId: string;
  type: string;            // e.g. "code_review", "web_search", "data_analysis"
  priority: LAPTaskPriority;
  deadline?: string;       // ISO timestamp
  payload: Record<string, any>;
  callback?: string;        // method name for result delivery
}

export interface LAPTaskDelegateRequest extends LAPMessage {
  method: 'lap.task.delegate';
  task: LAPTask;
}

export interface LAPTaskDelegateResponse {
  accepted: boolean;
  taskId: string;
  reason?: string;
  estimatedCompletion?: string; // ISO timestamp
}

export interface LAPTaskResultRequest extends LAPMessage {
  method: 'lap.task.result';
  taskId: string;
  status: LAPTaskStatus;
  output?: Record<string, any>;
  error?: string;
}

export interface LAPTaskResultResponse {
  acknowledged: boolean;
}

// ── 4. Negotiate ──

export type LAPNegotiateMode = 'consensus' | 'vote' | 'advise';

export interface LAPNegotiateRequest extends LAPMessage {
  method: 'lap.negotiate';
  topic: string;
  proposal: Record<string, any>;
  mode: LAPNegotiateMode;
  maxRounds: number;
}

export interface LAPNegotiateResponse {
  round: number;
  accepted: boolean;
  counterProposal?: Record<string, any>;
  reasoning?: string;
}

// ── 5. Notify ──

export interface LAPNotifyRequest extends LAPMessage {
  method: 'lap.notify';
  event: 'task.completed' | 'context.updated' | 'agent.online' | 'agent.offline' | 'alert';
  payload: Record<string, any>;
}

// ── 6. Revoke ──

export interface LAPRevokeRequest extends LAPMessage {
  method: 'lap.revoke';
  scope: 'all' | 'context' | 'delegate' | 'session';
  reason: string;
}

export interface LAPRevokeResponse {
  revoked: boolean;
  affectedTasks: string[];
}

// ── 7. Heartbeat ──

export interface LAPHeartbeatRequest extends LAPMessage {
  method: 'lap.heartbeat';
}

export interface LAPHeartbeatResponse {
  alive: boolean;
  serverTime: string;
}

// ── Union type for routing ──

export type LAPRequest =
  | LAPHandshakeRequest
  | LAPContextShareRequest
  | LAPTaskDelegateRequest
  | LAPTaskResultRequest
  | LAPNegotiateRequest
  | LAPNotifyRequest
  | LAPRevokeRequest
  | LAPHeartbeatRequest;
