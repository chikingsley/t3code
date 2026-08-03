import type {
  CustomRenderers,
  NodeStyleOverrides,
  PartialMarkdownTheme,
} from "react-native-nitro-markdown";
import { Text } from "react-native";

export type { CustomRenderers, NodeStyleOverrides, PartialMarkdownTheme };

export function Markdown({ children }: { readonly children: string }) {
  return <Text selectable>{children}</Text>;
}
