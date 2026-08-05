export const VOICE_LAB_BASE_URL = "https://voice-lab.peacockery.studio";
export const DEFAULT_VOICE_MODEL = "elevenlabs-scribe_v2";

export interface VoiceConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

const usesWebPreviewProxy = process.env.EXPO_PUBLIC_T3CODE_VOICE_PROXY === "1";

export function voiceConfig(): VoiceConfig {
  const previewOrigin =
    usesWebPreviewProxy && typeof globalThis.location?.origin === "string"
      ? `${globalThis.location.origin}/peacockery-voice`
      : null;
  const configuredBaseUrl = process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_BASE_URL?.trim();

  return {
    apiKey: usesWebPreviewProxy
      ? ""
      : (process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_API_KEY?.trim() ?? ""),
    baseUrl: previewOrigin ?? (configuredBaseUrl || VOICE_LAB_BASE_URL),
    model: process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_MODEL?.trim() || DEFAULT_VOICE_MODEL,
  };
}

export function isVoiceConfigured(): boolean {
  return usesWebPreviewProxy || voiceConfig().apiKey.length > 0;
}
