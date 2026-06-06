import { STTResult } from '../types';
import { getKey } from '../../config/keys';

function getApiKey(): string {
  // Doubao Speech uses AppID:AccessToken, Ark LLM key is separate
  const raw = process.env.DOUBAO_SPEECH_KEY || getKey('DOUBAO_SPEECH_KEY') || '';
  const colonIdx = raw.indexOf(':');
  if (colonIdx === -1) throw new Error('Doubao Speech not configured. Enter AppID:AccessToken in Settings → Voice Services.');
  return raw.slice(colonIdx + 1).trim();
}

export async function transcribe(
  audioBuffer: Buffer,
  language: string = 'zh',
): Promise<STTResult> {
  const apiKey = getApiKey();

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
  form.append('model', 'doubao-stt-1.0');
  form.append('language', language);

  const res = await fetch('https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash', {
    method: 'POST',
    headers: { Authorization: `Bearer;${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Doubao ASR error (${res.status}): ${err}`);
  }

  const data = await res.json() as any;
  return { text: data.text || '', isFinal: true };
}
