import * as Haptics from "expo-haptics";
import * as React from "react";
import { Alert, View } from "react-native";

import { AppText as Text } from "../../components/AppText";
import { ComposerToolbarButton } from "../../components/ComposerToolbarTrigger";
import { ControlPill } from "../../components/ControlPill";
import { useRealtimeDictation } from "./use-realtime-dictation";
import { isVoiceConfigured } from "./voice-config";

export function DictationButton(props: {
  readonly variant?: "pill" | "toolbar";
  readonly onCommit: (text: string) => void;
}) {
  const { errorMessage, isBusy, isRecording, liveText, start, stop } = useRealtimeDictation();
  const variant = props.variant ?? "pill";
  const alertedErrorRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!errorMessage || alertedErrorRef.current === errorMessage) {
      return;
    }
    alertedErrorRef.current = errorMessage;
    Alert.alert("Dictation unavailable", errorMessage);
  }, [errorMessage]);

  const handlePress = React.useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isBusy) {
      return;
    }
    if (!isRecording) {
      await start();
      return;
    }
    const result = await stop();
    if (result.text.length > 0) {
      props.onCommit(result.text);
    }
  }, [isBusy, isRecording, props, start, stop]);

  if (!isVoiceConfigured()) {
    return null;
  }

  const label = isRecording ? "Stop" : undefined;

  const button =
    variant === "toolbar" ? (
      <ComposerToolbarButton
        accessibilityLabel={isRecording ? "Stop dictation" : "Dictate with microphone"}
        icon={isRecording ? "stop.fill" : "mic.fill"}
        label={isRecording ? label : undefined}
        variant={isRecording ? "danger" : "default"}
        onPress={handlePress}
        disabled={isBusy}
        showChevron={false}
      />
    ) : (
      <ControlPill
        accessibilityLabel={isRecording ? "Stop dictation" : "Dictate with microphone"}
        icon={isRecording ? "stop.fill" : "mic.fill"}
        label={isRecording ? label : undefined}
        variant={isRecording ? "danger" : "circle"}
        onPress={handlePress}
        disabled={isBusy}
      />
    );

  return (
    <View className="items-center">
      {variant === "toolbar" && isRecording && liveText.length > 0 ? (
        <View className="mb-1 max-w-[280px] rounded-full bg-subtle-strong px-3 py-1">
          <Text className="text-foreground-muted text-xs" numberOfLines={2}>
            {liveText}
          </Text>
        </View>
      ) : null}
      {button}
    </View>
  );
}
