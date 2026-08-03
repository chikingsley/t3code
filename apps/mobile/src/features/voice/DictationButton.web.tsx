import { Alert } from "react-native";

import { ComposerToolbarButton } from "../../components/ComposerToolbarTrigger";
import { ControlPill } from "../../components/ControlPill";
import { isVoiceConfigured } from "./voice-config";

export function DictationButton(props: {
  readonly variant?: "pill" | "toolbar";
  readonly onCommit: (text: string) => void;
}) {
  if (!isVoiceConfigured()) {
    return null;
  }

  const showNativeBoundary = () => {
    Alert.alert(
      "Native dictation preview",
      "The microphone control is ready for iOS and Android. Browser Voice authentication needs a short-lived WebSocket ticket or application proxy.",
    );
  };

  if (props.variant === "toolbar") {
    return (
      <ComposerToolbarButton
        accessibilityLabel="Preview microphone control"
        icon="mic.fill"
        onPress={showNativeBoundary}
        showChevron={false}
      />
    );
  }

  return (
    <ControlPill
      accessibilityLabel="Preview microphone control"
      icon="mic.fill"
      onPress={showNativeBoundary}
      variant="circle"
    />
  );
}
