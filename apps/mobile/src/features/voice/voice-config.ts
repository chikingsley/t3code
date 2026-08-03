export const VOICE_LAB_BASE_URL = "https://voice-lab.peacockery.studio";
export const DEFAULT_VOICE_MODEL = "elevenlabs-scribe_v2";

export interface VoiceConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

export function voiceConfig(): VoiceConfig {
  return {
    apiKey: process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_API_KEY?.trim() ?? "",
    baseUrl: process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_BASE_URL?.trim() || VOICE_LAB_BASE_URL,
    model: process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_MODEL?.trim() || DEFAULT_VOICE_MODEL,
  };
}

export function isVoiceConfigured(): boolean {
  return voiceConfig().apiKey.length > 0;
}
