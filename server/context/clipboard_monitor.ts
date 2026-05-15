/**
 * Clipboard Monitor — tracks clipboard changes and extracts actionable content.
 *
 * Polls the desktop clipboard and compares against last known value.
 * When content changes, pushes clipboard_changed events to activity stream.
 */

import { pushActivityEvent } from './activity_stream';

const lastClipboard = new Map<string, { text: string; timestamp: string }>();
const CLIPBOARD_HISTORY_MAX = 20;
const clipboardHistory = new Map<string, Array<{ text: string; timestamp: string }>>();

export function getClipboardHistory(userId: string): Array<{ text: string; timestamp: string }> {
  return clipboardHistory.get(userId) || [];
}

export function addClipboardEntry(userId: string, text: string): void {
  if (!text.trim()) return;
  if (!clipboardHistory.has(userId)) {
    clipboardHistory.set(userId, []);
  }
  const history = clipboardHistory.get(userId)!;
  // Deduplicate consecutive identical entries
  if (history.length > 0 && history[history.length - 1].text === text) return;
  history.push({ text, timestamp: new Date().toISOString() });
  if (history.length > CLIPBOARD_HISTORY_MAX) {
    history.shift();
  }
}

export function detectClipboardChange(
  userId: string,
  currentText: string,
): { changed: boolean; prevText?: string } {
  const prev = lastClipboard.get(userId);
  if (!prev || prev.text !== currentText) {
    const prevText = prev?.text;
    lastClipboard.set(userId, { text: currentText, timestamp: new Date().toISOString() });
    addClipboardEntry(userId, currentText);
    if (currentText.trim()) {
      pushActivityEvent(userId, {
        type: 'clipboard_changed',
        timestamp: new Date().toISOString(),
        data: { text: currentText.slice(0, 500), prevText: prevText?.slice(0, 500) },
      });
    }
    return { changed: true, prevText };
  }
  return { changed: false };
}

/** Check if clipboard content looks like a URL */
export function isURL(text: string): boolean {
  return /^https?:\/\/\S+/i.test(text.trim());
}

/** Check if clipboard content looks like an error message */
export function isErrorText(text: string): boolean {
  return /(error|exception|failed|refused|denied|timed?\s*out|cannot|unable|fail|错误|异常|失败)/i.test(text) && text.length > 30;
}
