import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { readDB } from "../data/db_layer";
import { logger } from "../utils/logger";
import { registerChatHandler } from "./chat";
import { registerTaskHandler } from "./task";
import { registerVoiceHandlers, isEchoText, isTtsPlaying } from "./voice";
import { getSensory, perceptionEvents, MAX_PERCEPTION_EVENTS } from "./shared";
import { createWakeDetector } from "../stt/wake_detector";
import { loadEmotionalState, saveEmotionalState, updateEmotionalState } from "../personality/state";
import { pushActivityEvent, setIdleState, getIdleState, getLastEvent } from "../context/activity_stream";
import { processActivityEvent } from "../context/proactive_triggers";
import { detectClipboardChange } from "../context/clipboard_monitor";
import type { SocketDeps } from "./types";

export type { SocketDeps } from "./types";

export function registerAllSocketHandlers(io: Server, deps: SocketDeps) {
  const {
    jwtSecret,
    deviceRegistry,
    llmGetters,
    registerUserSocket,
    unregisterUserSocket,
  } = deps;

  function getUserIdFromSocket(socket: any): string {
    try {
      const authToken = socket.handshake?.auth?.token;
      if (authToken) {
        const decoded: any = jwt.verify(authToken, jwtSecret);
        return decoded.uid || 'anonymous';
      }
      const cookies = socket.handshake.headers.cookie;
      if (cookies) {
        const token = cookies.split(';').find((c: string) => c.trim().startsWith('token='))?.split('=')[1];
        if (token) {
          const decoded: any = jwt.verify(token, jwtSecret);
          return decoded.uid || 'anonymous';
        }
      }
    } catch {}
    return 'anonymous';
  }

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // DEBUG: log all incoming events
    socket.onAny((event, ...args) => {
      if (event !== 'device:register') {
        console.log(`[Socket:${socket.id}] event: ${event} args:`, JSON.stringify(args).slice(0, 200));
      }
    });

    // Device registration
    socket.on("device:register", (data: {
      name?: string;
      type?: string;
      capabilities?: Record<string, boolean>;
      osInfo?: string;
    }) => {
      const uid = getUserIdFromSocket(socket);
      deviceRegistry.register(uid, socket.id, {
        name: data.name,
        type: data.type as any,
        capabilities: data.capabilities as any,
        osInfo: data.osInfo,
        ipAddress: socket.handshake.address,
      });
      registerUserSocket(uid, socket.id);
    });

    socket.on("ping", () => { socket.emit("pong"); });

    socket.on("disconnect", () => {
      const uid = getUserIdFromSocket(socket);
      perceptionEvents.delete(uid);
      deviceRegistry.disconnect(socket.id);
      unregisterUserSocket(socket.id);
    });

    // Multimodal perception events
    socket.on("perception:visual_scene", (data: { description: string; objects?: string[]; faces?: number }) => {
      const uid = getUserIdFromSocket(socket);
      const events = perceptionEvents.get(uid) || [];
      events.push({ modality: 'visual', deviceId: socket.id, timestamp: new Date().toISOString(), data });
      if (events.length > MAX_PERCEPTION_EVENTS) events.shift();
      perceptionEvents.set(uid, events);
    });

    socket.on("perception:audio_emotion", (data: { emotion: string; intensity?: number }) => {
      const uid = getUserIdFromSocket(socket);
      const events = perceptionEvents.get(uid) || [];
      events.push({ modality: 'audio', deviceId: socket.id, timestamp: new Date().toISOString(), data });
      if (events.length > MAX_PERCEPTION_EVENTS) events.shift();
      perceptionEvents.set(uid, events);

      if (uid !== 'anonymous') {
        const emotionImpact: Record<string, number> = {
          happy: 0.5, excited: 0.4, calm: 0.1,
          sad: -0.3, angry: -0.5, frustrated: -0.4,
          neutral: 0,
        };
        const intensity = (emotionImpact[data.emotion] || 0) * (data.intensity || 0.5);
        if (Math.abs(intensity) > 0.05) {
          const state = loadEmotionalState(uid);
          const eventType = intensity > 0 ? 'positive_feedback' : 'negative_feedback';
          const updated = updateEmotionalState(state, {
            type: eventType,
            intensity: Math.abs(intensity),
            userId: uid,
            timestamp: new Date().toISOString(),
          });
          saveEmotionalState(uid, updated);
        }
      }
    });

    socket.on("perception:spatial_update", (data: { roomType?: string; dimensions?: { x: number; y: number; z: number } }) => {
      const uid = getUserIdFromSocket(socket);
      const events = perceptionEvents.get(uid) || [];
      events.push({ modality: 'spatial', deviceId: socket.id, timestamp: new Date().toISOString(), data });
      if (events.length > MAX_PERCEPTION_EVENTS) events.shift();
      perceptionEvents.set(uid, events);
    });

    // Idle background processing
    async function triggerIdleProcessing(userId: string, io: any) {
      try {
        const db = readDB();
        const activeConv = (db.conversations || []).find(
          (c: any) => c.userId === userId && c.status === 'active'
        );
        if (activeConv && activeConv.messageCount >= 10 && !activeConv.summary) {
          const { checkAutoSummary } = await import('../conversation/manager');
          checkAutoSummary(activeConv.id);
          console.log(`[IdleProcessing] Triggered auto-summary for conversation ${activeConv.id}`);
        }
      } catch (err: any) {
        console.warn(`[IdleProcessing] Summarize failed: ${err.message}`);
      }
      try {
        const { cleanupEphemeralAgents } = await import('../agents/orchestrator');
        const cleaned = cleanupEphemeralAgents(6);
        if (cleaned > 0) console.log(`[IdleProcessing] Cleaned up ${cleaned} ephemeral agents`);
      } catch {}
    }

    // Ambient awareness handlers
    socket.on("ambient:window_update", (data: { title: string; process_name: string; pid: number }) => {
      const uid = getUserIdFromSocket(socket);
      if (!uid) return;
      const prev = getLastEvent(uid, 'window_changed');
      const prevTitle = prev?.data?.title || '';
      const prevProc = prev?.data?.process_name || '';
      const changed = data.title !== prevTitle || data.process_name !== prevProc;
      const event = { type: 'window_changed' as const, timestamp: new Date().toISOString(), data };
      pushActivityEvent(uid, event);
      if (changed) {
        processActivityEvent(event, uid, io);
      }
    });

    socket.on("ambient:idle_report", (data: { idle_ms: number; idle_seconds: number }) => {
      const uid = getUserIdFromSocket(socket);
      if (!uid) return;
      const isIdle = data.idle_seconds > 60;
      const wasIdle = getIdleState(uid).isIdle;
      setIdleState(uid, isIdle);
      socket.emit("ambient:idle_echo", data);
      if (isIdle && !wasIdle) {
        triggerIdleProcessing(uid, io).catch(err =>
          console.warn(`[IdleProcessing] Background task failed for ${uid}:`, err.message)
        );
      }
    });

    // Track ambient noise per-user for environment-aware proactive voice
    const ambientNoise = new Map<string, { rms: number; lastUpdate: string }>();

    socket.on("ambient:noise_level", (data: { rms: number; isSpeaking: boolean; callState: string; timestamp: string }) => {
      const uid = getUserIdFromSocket(socket);
      if (!uid) return;
      ambientNoise.set(uid, { rms: data.rms, lastUpdate: data.timestamp });
    });

    socket.on("ambient:clipboard_report", (data: { text: string }) => {
      const uid = getUserIdFromSocket(socket);
      if (!uid) return;
      const result = detectClipboardChange(uid, data.text || '');
      if (result.changed) {
        const event = getLastEvent(uid, 'clipboard_changed');
        if (event) {
          processActivityEvent(event, uid, io);
        }
      }
    });

    // Chat handler (from server/socket/chat.ts)
    registerChatHandler(socket, llmGetters, (uid: string) => getSensory(uid), getUserIdFromSocket);

    // Task handler (from server/socket/task.ts)
    registerTaskHandler(socket, llmGetters, (uid: string) => getSensory(uid), getUserIdFromSocket);

    // Conversation list
    socket.on("chat:conversations", async () => {
      try {
        const uid = getUserIdFromSocket(socket);
        const db = readDB();
        const convs = (db.conversations || [])
          .filter((c: any) => c.userId === uid)
          .sort((a: any, b: any) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
          .slice(0, 30);

        const interactionsByConv = new Map<string, any[]>();
        for (const i of (db.interactions || [])) {
          const cid = i.conversationId;
          if (!cid) continue;
          if (!interactionsByConv.has(cid)) interactionsByConv.set(cid, []);
          interactionsByConv.get(cid)!.push(i);
        }

        const list = convs.map((c: any) => {
          const convInteractions = interactionsByConv.get(c.id) || [];
          const lastInteraction = convInteractions[convInteractions.length - 1];
          const firstMsg = convInteractions[0];
          return {
            id: c.id,
            title: c.title || (firstMsg?.content || firstMsg?.message || 'New Conversation').slice(0, 50),
            messageCount: c.messageCount || 0,
            lastActiveAt: c.lastActiveAt,
            createdAt: c.createdAt,
            preview: (lastInteraction?.response || '').slice(0, 80) || (lastInteraction?.content || '').slice(0, 80),
          };
        });
        socket.emit("chat:conversations", { conversations: list });
      } catch (err) {
        console.error("[chat:conversations] Error:", err);
        socket.emit("chat:conversations", { conversations: [] });
      }
    });

    // Load messages for a specific conversation
    socket.on("chat:messages", async (data: { conversationId: string }) => {
      try {
        if (!data.conversationId) {
          socket.emit("chat:messages", { conversationId: '', messages: [] });
          return;
        }
        const db = readDB();
        const interactions = (db.interactions || [])
          .filter((i: any) => i.conversationId === data.conversationId)
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(-100);

        const messages: any[] = [];
        for (const i of interactions) {
          if (i.content || i.message) {
            messages.push({ id: i.id + '_u', type: 'user-text', content: i.content || i.message, timestamp: i.timestamp });
          }
          const tcs = Array.isArray(i.toolCalls) ? i.toolCalls : [];
          for (const tc of tcs) {
            messages.push({ id: i.id + '_t_' + tc.name, type: 'tool', name: tc.name, args: tc.args || tc.arguments || {}, status: 'done', timestamp: i.timestamp });
          }
          if (i.response) {
            messages.push({ id: i.id + '_r', type: 'lumi', content: i.response, timestamp: i.timestamp });
          }
        }
        socket.emit("chat:messages", { conversationId: data.conversationId, messages });
      } catch (err) {
        console.error("[chat:messages] Error:", err);
        socket.emit("chat:messages", { conversationId: data.conversationId, messages: [] });
      }
    });

    // Wake word detection via Qwen ASR
    let wakeDetector: ReturnType<typeof createWakeDetector> | null = null;

    socket.on("wake:start", async () => {
      const uid = getUserIdFromSocket(socket);
      try {
        if (wakeDetector) { try { wakeDetector.stop(); } catch {} }
        wakeDetector = createWakeDetector(undefined, isEchoText);
        wakeDetector.onWake((keyword: string) => {
          logger.info(`[Wake] "${keyword}" detected for user ${uid}`);
          socket.emit("wake:detected", { keyword, timestamp: new Date().toISOString() });
        });
        wakeDetector.onError((err: Error) => {
          logger.error(`[Wake] Error for user ${uid}:`, err.message);
          socket.emit("wake:error", { message: err.message });
        });
        socket.emit("wake:started");
        logger.info(`[Wake] Started for user ${uid}`);
      } catch (err: any) {
        socket.emit("wake:error", { message: err.message || 'Failed to start wake detector' });
      }
    });

    socket.on("wake:audio", (data: { audio: number[] }) => {
      if (!wakeDetector) return;
      if (isTtsPlaying()) return;
      try {
        const buf = Buffer.from(new Int16Array(data.audio).buffer);
        wakeDetector.sendAudio(buf);
      } catch {}
    });

    socket.on("wake:stop", () => {
      if (wakeDetector) {
        try { wakeDetector.stop(); } catch {}
        wakeDetector = null;
      }
    });

    // Voice handlers (from server/socket/voice.ts)
    registerVoiceHandlers(socket, llmGetters, (uid: string) => getSensory(uid), getUserIdFromSocket);
  });
}
