import { STTConfig, STTResult, STTProvider } from './types';
import * as deepgram from './providers/deepgram';
import * as whisper from './providers/whisper';
import * as qwen from './providers/qwen';
import { getKey } from '../config/keys';
import { recordLatency } from '../monitor/latency_store';

export async function transcribe(audioBuffer: Buffer, config: STTConfig): Promise<STTResult> {
  const start = Date.now();
  let result: STTResult;
  switch (config.provider) {
    case 'whisper':
      result = await whisper.transcribe(audioBuffer, config.language);
      break;
    case 'deepgram':
      result = await new Promise((resolve, reject) => {
        const session = deepgram.createStream(config.language, false);
        session.onResult((result) => {
          if (result.isFinal) resolve(result);
        });
        session.onError(reject);
        session.sendAudio(audioBuffer);
        session.end();
        setTimeout(() => resolve({ text: '', isFinal: false }), 8000);
      });
      break;
    case 'qwen':
      result = await new Promise((resolve, reject) => {
        const session = qwen.createStream(config.language || 'zh', false);
        session.onResult((result) => {
          if (result.isFinal) resolve(result);
        });
        session.onError(reject);
        session.sendAudio(audioBuffer);
        session.end();
        setTimeout(() => resolve({ text: '', isFinal: false }), 8000);
      });
      break;
    default:
      throw new Error(`Unknown STT provider: ${config.provider}`);
  }
  recordLatency('stt', Date.now() - start);
  return result;
}

export function createStreamingSession(
  config: STTConfig,
): deepgram.DeepgramStreamSession | qwen.QwenStreamSession {
  if (config.provider === 'qwen') {
    return qwen.createStream(config.language, config.interimResults);
  }
  if (config.provider === 'deepgram') {
    return deepgram.createStream(config.language, config.interimResults);
  }
  throw new Error(`Streaming only supports Deepgram and Qwen-ASR (requested: ${config.provider})`);
}

export function getActiveSTTProvider(): STTProvider | null {
  const qwenKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY
    || getKey('DASHSCOPE_API_KEY') || getKey('QWEN_API_KEY');
  if (qwenKey) return 'qwen';
  if (process.env.DEEPGRAM_API_KEY || getKey('DEEPGRAM_API_KEY')) return 'deepgram';
  if (process.env.OPENAI_API_KEY || getKey('OPENAI_API_KEY')) return 'whisper';
  return null;
}
