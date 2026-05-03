import { TTSConfig, TTSResult, TTSProvider, VoiceCloneRequest, VoiceListItem } from './types';
import * as elevenlabs from './providers/elevenlabs';
import * as fishaudio from './providers/fishaudio';
import * as gptsovits from './providers/gptsovits';

export async function synthesizeSpeech(text: string, config: TTSConfig): Promise<TTSResult> {
  switch (config.provider) {
    case 'elevenlabs':
      return elevenlabs.synthesizeSpeech(
        text,
        config.voiceId,
        config.model,
        config.stability,
        config.similarityBoost,
        config.signal,
      );
    case 'fishaudio':
      return fishaudio.synthesizeSpeech(text, config.voiceId, config.signal);
    case 'gptsovits':
      return gptsovits.synthesizeSpeech(text, config.voiceId, config.signal);
    default:
      throw new Error(`Unknown TTS provider: ${config.provider}`);
  }
}

export async function cloneVoice(request: VoiceCloneRequest, provider: TTSProvider): Promise<string> {
  switch (provider) {
    case 'elevenlabs':
      return elevenlabs.cloneVoice(request.sampleUrls, request.name);
    case 'fishaudio':
      return fishaudio.cloneVoice(request.sampleUrls, request.name);
    default:
      throw new Error(`Voice cloning not supported for provider: ${provider}`);
  }
}

export async function listVoices(provider: TTSProvider): Promise<VoiceListItem[]> {
  switch (provider) {
    case 'elevenlabs':
      return elevenlabs.listVoices();
    case 'fishaudio':
      return fishaudio.listVoices();
    case 'gptsovits':
      return [{ voiceId: 'lumi', name: 'Lumi Voice', category: 'cloned', language: 'zh' }];
    default:
      throw new Error(`Unknown TTS provider: ${provider}`);
  }
}

export function getActiveProvider(): TTSProvider | null {
  if (process.env.FISHAUDIO_API_KEY) return 'fishaudio';
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  // Default to local GPT-SoVITS when no cloud API keys are set
  return 'gptsovits';
}
