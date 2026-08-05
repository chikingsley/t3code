import { createNanoIconSet } from "react-native-nano-icons";

import providerGlyphMap from "./assets/VibePadProviders.glyphmap.json";

const ProviderNanoIcon = createNanoIconSet(providerGlyphMap);

export type ProviderGlyphName = "anthropic" | "openai" | "opencode" | "xai";

export function ProviderGlyph({
  color,
  name,
  size = 20,
}: {
  readonly color: string;
  readonly name: ProviderGlyphName;
  readonly size?: number;
}) {
  return <ProviderNanoIcon allowFontScaling={false} color={color} name={name} size={size} />;
}
