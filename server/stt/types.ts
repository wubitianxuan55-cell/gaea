export type STTProvider = 'deepgram' | 'whisper';

export interface STTConfig {
  provider: STTProvider;
  language?: string;
  interimResults?: boolean;
}

export interface STTResult {
  text: string;
  isFinal: boolean;
}
