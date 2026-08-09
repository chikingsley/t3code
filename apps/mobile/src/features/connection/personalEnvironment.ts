import Constants from "expo-constants";

type PersonalEnvironmentExtra =
  | {
      readonly personalEnvironment?: {
        readonly url?: unknown;
      };
    }
  | undefined;

export function resolvePersonalEnvironmentUrl(
  extra: PersonalEnvironmentExtra = Constants.expoConfig?.extra,
): string | null {
  const raw = extra?.personalEnvironment?.url;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
