import { TTSResult } from '../types';

const BASE_URL = 'http://127.0.0.1:9880';

// Default reference audio for the Lumi voice
const DEFAULT_REF_AUDIO = '../data/voice_training/segments/segment_0000.wav';
const DEFAULT_PROMPT_TEXT = '各位朋友大家好，今天想和大家分享的';

export async function synthesizeSpeech(
  text: string,
  _voiceId?: string,
  signal?: AbortSignal,
): Promise<TTSResult> {
  const body: Record<string, unknown> = {
    text,
    text_lang: 'zh',
    ref_audio_path: DEFAULT_REF_AUDIO,
    prompt_text: DEFAULT_PROMPT_TEXT,
    prompt_lang: 'zh',
    text_split_method: 'cut0',
    batch_size: 1,
    media_type: 'wav',
    streaming_mode: false,
  };

  const res = await fetch(`${BASE_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`GPT-SoVITS TTS error (${res.status}): ${err.message || err.detail}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    audioBuffer: Buffer.from(arrayBuffer),
    format: 'audio/wav',
  };
}
