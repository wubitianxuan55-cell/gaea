import { STTResult } from '../types';
import { logger } from '../../../logger';

function getApiKey(): string {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error('DEEPGRAM_API_KEY is not configured');
  return key;
}

export interface DeepgramStreamSession {
  sendAudio(chunk: Buffer): void;
  end(): void;
  onResult: (callback: (result: STTResult) => void) => void;
  onError: (callback: (err: Error) => void) => void;
}

export function createStream(
  language: string = 'zh-CN',
  interimResults: boolean = true,
): DeepgramStreamSession {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    encoding: 'opus',
    sample_rate: '48000',
    channels: '1',
    language,
    interim_results: String(interimResults),
    punctuate: 'true',
  });

  const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

  const WebSocketImpl = (globalThis as any).WebSocket;
  if (!WebSocketImpl) {
    throw new Error('WebSocket not available. Requires Node.js 22+ or install ws package.');
  }
  const ws = new WebSocketImpl(url, {
    headers: { Authorization: `Token ${apiKey}` },
  });

  const resultCallbacks: Array<(result: STTResult) => void> = [];
  const errorCallbacks: Array<(err: Error) => void> = [];

  ws.on('open', () => {
    logger.info('[Deepgram] Streaming session started');
  });

  ws.on('message', (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(raw.toString());
      const { type, channel } = msg;

      if (type === 'Results') {
        const { alternatives, is_final } = channel || msg;
        if (alternatives && alternatives.length > 0) {
          const text = alternatives[0].transcript || '';
          const result: STTResult = { text, isFinal: is_final ?? true };
          resultCallbacks.forEach(cb => cb(result));
        }
      }
    } catch {
      // Binary data, ignore
    }
  });

  ws.on('error', (err: Error) => {
    errorCallbacks.forEach(cb => cb(err));
  });

  ws.on('close', () => {
    logger.info('[Deepgram] Streaming session closed');
  });

  return {
    sendAudio(chunk: Buffer) {
      if (ws.readyState === WebSocketImpl.OPEN) {
        ws.send(chunk);
      }
    },
    end() {
      if (ws.readyState === WebSocketImpl.OPEN) {
        ws.send(JSON.stringify({ type: 'CloseStream' }));
        setTimeout(() => ws.close(), 500);
      }
    },
    onResult(callback) {
      resultCallbacks.push(callback);
    },
    onError(callback) {
      errorCallbacks.push(callback);
    },
  };
}
