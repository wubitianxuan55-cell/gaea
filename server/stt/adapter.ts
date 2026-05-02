import { STTConfig, STTResult, STTProvider } from './types';
import * as deepgram from './providers/deepgram';
import * as whisper from './providers/whisper';

export async function transcribe(audioBuffer: Buffer, config: STTConfig): Promise<STTResult> {
  switch (config.provider) {
    case 'whisper':
      return whisper.transcribe(audioBuffer, config.language);
    case 'deepgram':
      return new Promise((resolve, reject) => {
        const session = deepgram.createStream(config.language, false);
        let finalResult: STTResult = { text: '', isFinal: false };
        session.onResult((result) => {
          if (result.isFinal) finalResult = result;
        });
        session.onError(reject);
        session.sendAudio(audioBuffer);
        session.end();
        setTimeout(() => resolve(finalResult), 3000); // Timeout fallback
      });
    default:
      throw new Error(`Unknown STT provider: ${config.provider}`);
  }
}

export function createStreamingSession(
  config: STTConfig,
): deepgram.DeepgramStreamSession {
  if (config.provider !== 'deepgram') {
    throw new Error('Streaming only supports Deepgram');
  }
  return deepgram.createStream(config.language, config.interimResults);
}

export function getActiveSTTProvider(): STTProvider | null {
  if (process.env.DEEPGRAM_API_KEY) return 'deepgram';
  if (process.env.OPENAI_API_KEY) return 'whisper';
  return null;
}
