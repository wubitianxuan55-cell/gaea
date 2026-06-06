import { STTResult } from '../types';
import { getKey } from '../../config/keys';

function getApiKey(): string {
  const key = process.env.ARK_API_KEY || getKey('ARK_API_KEY');
  if (!key) throw new Error('ARK_API_KEY not configured. Add it in Settings → API Matrix.');
  return key;
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

  const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ark ASR error (${res.status}): ${err}`);
  }

  const data = await res.json() as any;
  return { text: data.text || '', isFinal: true };
}
