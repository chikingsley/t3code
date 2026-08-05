import { useState } from "react";
import { StyleSheet } from "react-native";

import { useScaledTextRole } from "../features/settings/appearance/useScaledTextRole";
import { ComposerEditor, type ComposerEditorProps } from "./ComposerEditor";
import { resolveComposerEditorSizing } from "./composer-editor-sizing";

export function AutoGrowingComposerEditor(
  props: Omit<ComposerEditorProps, "onContentSizeChange" | "scrollEnabled"> & {
    readonly maximumLineCount?: number;
    readonly minimumLineCount?: number;
  },
) {
  const bodyText = useScaledTextRole("body");
  const resolvedTextStyle = StyleSheet.flatten(props.textStyle) ?? {};
  const lineHeight =
    typeof resolvedTextStyle.lineHeight === "number"
      ? resolvedTextStyle.lineHeight
      : bodyText.lineHeight;
  const minimumLineCount = props.minimumLineCount ?? 1;
  const maximumLineCount = Math.max(minimumLineCount, props.maximumLineCount ?? 3);
  const verticalInset = props.contentInsetVertical ?? 0;
  const minimumHeight = lineHeight * minimumLineCount + verticalInset * 2;
  const [contentHeight, setContentHeight] = useState(minimumHeight);
  const sizing = resolveComposerEditorSizing({
    contentHeight,
    lineHeight,
    maximumLineCount,
    minimumLineCount,
    verticalInset,
  });

  return (
    <ComposerEditor
      {...props}
      onContentSizeChange={(contentSize) => {
        setContentHeight((current) =>
          Math.abs(current - contentSize.height) > 0.5 ? contentSize.height : current,
        );
      }}
      scrollEnabled={sizing.scrollEnabled}
      style={[props.style, { height: sizing.height }]}
    />
  );
}
