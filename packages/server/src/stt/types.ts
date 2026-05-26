export type STTProvider = 'deepgram' | 'whisper' | 'qwen';

export interface STTConfig {
  provider: STTProvider;
  language?: string;
  interimResults?: boolean;
}

export interface STTResult {
  text: string;
  isFinal: boolean;
  /** Deepgram: true when the user has finished speaking (VAD endpointing) */
  speechFinal?: boolean;
  sentiment?: {
    sentiment: 'positive' | 'negative' | 'neutral';
    sentiment_score: number;
  };
}
