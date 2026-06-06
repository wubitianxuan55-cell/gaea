import { TTSResult, VoiceListItem } from '../types';
import { getKey } from '../../config/keys';
import { withCloudResilience } from '../../cloud/resilience';

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/audio/speech';

function getApiKey(): string {
  const key = process.env.ARK_API_KEY || getKey('ARK_API_KEY');
  if (!key) throw new Error('ARK_API_KEY not configured. Add it in Settings → API Matrix.');
  return key;
}

const PRESET_VOICES: VoiceListItem[] = [
  { voiceId: 'zh_female_qingxin', name: '清新女声', category: 'premade', language: 'zh' },
  { voiceId: 'zh_male_qingse', name: '青涩男声', category: 'premade', language: 'zh' },
  { voiceId: 'zh_female_shuangkuai', name: '爽快女声', category: 'premade', language: 'zh' },
  { voiceId: 'zh_male_haoting', name: '好听男声', category: 'premade', language: 'zh' },
  { voiceId: 'zh_female_wenrou', name: '温柔女声', category: 'premade', language: 'zh' },
  { voiceId: 'zh_male_wenhou', name: '温厚男声', category: 'premade', language: 'zh' },
];

export async function synthesizeSpeech(
  text: string,
  voiceId: string = 'zh_female_qingxin',
  signal?: AbortSignal,
  speechRate?: number,
  pitch?: number,
  volume?: number,
): Promise<TTSResult> {
  const apiKey = getApiKey();

  const body: Record<string, any> = {
    model: 'doubao-tts-1.0',
    input: text,
    voice: voiceId,
    response_format: 'mp3',
  };
  if (speechRate !== undefined) body.speed = speechRate;

  const res = await withCloudResilience(
    () => fetch(BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    }),
    { provider: 'ark-tts', maxRetries: 1 },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Ark TTS error (${res.status}): ${err.message || err.code || 'Unknown'}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    audioBuffer: Buffer.from(arrayBuffer),
    format: 'audio/mp3',
  };
}

export async function listVoices(): Promise<VoiceListItem[]> {
  return PRESET_VOICES;
}
