import { Text, type TextProps } from "react-native";

export type SelectionChangeEvent = {
  nativeEvent: { target: number; start: number; end: number };
};

export type MarkdownTextPrimitiveProps = TextProps & {
  uiTextView?: boolean;
  onSelectionChange?: (event: SelectionChangeEvent) => void;
};

export function MarkdownTextPrimitive({
  uiTextView: _uiTextView,
  onSelectionChange: _onSelectionChange,
  ...props
}: MarkdownTextPrimitiveProps) {
  return <Text {...props} />;
}
