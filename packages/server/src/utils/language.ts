/**
 * Lightweight language detection for Chinese vs English mixed input.
 * No dependencies — pure regex heuristics.
 */

export type DetectedLanguage = 'zh' | 'en' | 'mixed';

/** Detect dominant language from raw user input text */
export function detectLanguage(text: string): DetectedLanguage {
  const stripped = text.replace(/[\s\d\p{P}]/gu, '');
  if (stripped.length === 0) return 'en';

  let cjk = 0;
  let latin = 0;

  for (const ch of stripped) {
    const code = ch.codePointAt(0) || 0;
    if (
      (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified
      (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
      (code >= 0x20000 && code <= 0x2A6DF)  // CJK Extension B
    ) {
      cjk++;
    } else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
      latin++;
    }
  }

  const total = cjk + latin;
  if (total === 0) return 'en';

  const cjkRatio = cjk / total;
  if (cjkRatio > 0.7) return 'zh';
  if (cjkRatio < 0.3) return 'en';
  return 'mixed';
}

/** Get the recommended response language based on input */
export function getResponseLanguage(userText?: string): string {
  if (!userText) return 'zh, en';
  const lang = detectLanguage(userText);
  if (lang === 'zh') return 'zh';
  if (lang === 'en') return 'en';
  return 'zh, en';
}
