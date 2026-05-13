import { STTResult } from '../types';
import { getKey } from '../../config/keys';

function getApiKey(): string {
  return process.env.OPENAI_API_KEY || getKey('OPENAI_API_KEY') || '';
}

export async function transcribe(
  audioBuffer: Buffer,
  language: string = 'zh',
): Promise<STTResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('language', language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper error (${res.status}): ${err}`);
  }

  const data = await res.json() as any;
  return { text: data.text || '', isFinal: true };
}
