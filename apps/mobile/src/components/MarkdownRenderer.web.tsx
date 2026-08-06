import type {
  CustomRenderers,
  MarkdownProps,
  NodeStyleOverrides,
  PartialMarkdownTheme,
} from "react-native-nitro-markdown";
import { Text } from "react-native";

export type { CustomRenderers, NodeStyleOverrides, PartialMarkdownTheme };

export function Markdown({ children, styles, theme }: MarkdownProps) {
  return (
    <Text selectable style={[{ color: theme?.colors?.text }, styles?.text]}>
      {children}
    </Text>
  );
}
