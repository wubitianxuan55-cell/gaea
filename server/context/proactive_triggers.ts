/**
 * Proactive Triggers — rule engine matching ambient events to proactive actions.
 *
 * Listens to activity stream events (window changes, clipboard, idle state)
 * and generates proactive suggestions via socket emission to the frontend.
 */

import { Server as SocketIOServer } from 'socket.io';
import { ActivityEvent } from './activity_stream';
import { isURL, isErrorText } from './clipboard_monitor';

export interface ProactiveSuggestion {
  id: string;
  userId: string;
  type: 'clipboard_url' | 'clipboard_error' | 'idle_greeting' | 'window_context';
  message: string;
  action?: string; // Suggested action
  timestamp: string;
}

const cooldowns = new Map<string, number>(); // key -> last fire timestamp
const COOLDOWN_MS: Record<string, number> = {
  clipboard_url: 60_000,    // 1 min between URL suggestions
  clipboard_error: 120_000, // 2 min between error suggestions
  idle_greeting: 300_000,   // 5 min between idle greetings
  window_context: 120_000,  // 2 min between window context suggestions
};

function isOnCooldown(userId: string, type: string): boolean {
  const key = `${userId}_${type}`;
  const last = cooldowns.get(key) || 0;
  const cooldown = COOLDOWN_MS[type] || 60_000;
  if (Date.now() - last < cooldown) return true;
  cooldowns.set(key, Date.now());
  return false;
}

export function processActivityEvent(
  event: ActivityEvent,
  userId: string,
  io: SocketIOServer,
): ProactiveSuggestion | null {
  // ── Clipboard URL copied ──
  if (event.type === 'clipboard_changed' && event.data?.text) {
    const text = event.data.text as string;
    if (isURL(text) && !isOnCooldown(userId, 'clipboard_url')) {
      const suggestion: ProactiveSuggestion = {
        id: `proactive_${Date.now()}`,
        userId,
        type: 'clipboard_url',
        message: '我注意到你复制了一个链接，需要我帮你打开或总结内容吗？',
        action: 'summarize_url',
        timestamp: new Date().toISOString(),
      };
      // Emit to user's socket room
      io.to(`user:${userId}`).emit('lumi:proactive', suggestion);
      return suggestion;
    }
    if (isErrorText(text) && !isOnCooldown(userId, 'clipboard_error')) {
      const suggestion: ProactiveSuggestion = {
        id: `proactive_${Date.now()}`,
        userId,
        type: 'clipboard_error',
        message: '看起来你遇到了一个错误，需要我帮你分析一下吗？',
        action: 'debug_error',
        timestamp: new Date().toISOString(),
      };
      io.to(`user:${userId}`).emit('lumi:proactive', suggestion);
      return suggestion;
    }
  }

  // ── Window changed — check for known productivity apps ──
  if (event.type === 'window_changed' && event.data?.process_name) {
    const proc = (event.data.process_name as string).toLowerCase();
    const appSuggestions: Record<string, string> = {
      'powerpnt.exe': '需要我帮你制作演示文稿吗？',
      'winword.exe': '需要我帮你写文档或生成内容吗？',
      'excel.exe': '需要我帮你分析数据或创建表格吗？',
      'devenv.exe': '需要我帮你审查代码或调试问题吗？',
      'code.exe': '有什么代码问题我可以帮你？',
      'slack.exe': '',
      'teams.exe': '',
      'chrome.exe': '',
    };
    const msg = appSuggestions[proc];
    if (msg && !isOnCooldown(userId, 'window_context')) {
      const suggestion: ProactiveSuggestion = {
        id: `proactive_${Date.now()}`,
        userId,
        type: 'window_context',
        message: msg,
        timestamp: new Date().toISOString(),
      };
      io.to(`user:${userId}`).emit('lumi:proactive', suggestion);
      return suggestion;
    }
  }

  return null;
}
