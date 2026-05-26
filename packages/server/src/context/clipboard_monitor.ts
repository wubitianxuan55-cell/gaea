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

/** Check if text looks like a code snippet */
export function isCodeSnippet(text: string): boolean {
  const t = text.trim();
  if (t.length < 20 || t.length > 2000) return false;
  const codeIndicators = [
    /\b(function|const|let|var|class|import|export|return|async|await)\b/,
    /\b(if|else|for|while|switch|case|try|catch|throw)\b/,
    /\b(def|fn|mod|use|impl|struct|enum|pub|match)\b/,
    /[{};]\s*$/m,
    /^\s*(public|private|protected)\s/,
    /=>\s*[{(\w]/,
    /^\s*#include|^\s*package\s|^\s*import\s/,
  ];
  const hits = codeIndicators.filter(r => r.test(t)).length;
  return hits >= 2;
}

/** Check if text looks like a file path */
export function isFilePath(text: string): boolean {
  const t = text.trim();
  return /^([A-Za-z]:\\|\\\\(?:[^\\]+\\)|~\/|\/[a-z]+\/)/.test(t) && !/\n/.test(t) && t.length > 5 && t.length < 300;
}

/** Check if text looks like a stack trace */
export function isStackTrace(text: string): boolean {
  const t = text.trim();
  return /\n\s+at\s+\S+\.\S+\s*\(.+\.(ts|tsx|js|jsx|py|rs|go|java):\d+:\d+\)/i.test(t)
    || /\nTraceback\s/i.test(t)
    || /^\s*File\s+"[^"]+",\s*line\s+\d+/im.test(t);
}

/** Classify clipboard content into categories */
export function classifyClipboard(text: string): { type: 'url' | 'error' | 'code' | 'file_path' | 'stack_trace' | 'log' | 'none'; label: string } {
  const t = text.trim();
  if (!t) return { type: 'none', label: '' };
  if (isURL(t)) return { type: 'url', label: 'copied a URL' };
  if (isStackTrace(t)) return { type: 'stack_trace', label: 'copied a stack trace' };
  if (isErrorText(t)) return { type: 'error', label: 'copied an error message' };
  if (isCodeSnippet(t)) return { type: 'code', label: 'copied code' };
  if (isFilePath(t)) return { type: 'file_path', label: 'copied a file path' };
  if (t.length > 50 && /\d{4}-\d{2}-\d{2}.*(ERROR|WARN|INFO|DEBUG)/.test(t)) return { type: 'log', label: 'copied a log entry' };
  return { type: 'none', label: '' };
}
