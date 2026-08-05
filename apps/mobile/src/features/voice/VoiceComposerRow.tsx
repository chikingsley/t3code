import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { ComposerCompactRow } from "../../components/ComposerChrome";
import { ControlPill } from "../../components/ControlPill";
import { AppText as Text } from "../../components/AppText";
import { useThemeColor } from "../../lib/useThemeColor";
import { VoiceWaveform } from "./VoiceWaveform";

function formatElapsedTime(elapsedSeconds: number): string {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function VoiceElapsedTime(props: { readonly startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (props.startedAt === null) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [props.startedAt]);
  const seconds =
    props.startedAt === null ? 0 : Math.max(0, Math.floor((now - props.startedAt) / 1_000));
  return <Text className="text-xs tabular-nums text-foreground">{formatElapsedTime(seconds)}</Text>;
}

export function VoiceComposerRow(props: {
  readonly levels: SharedValue<ReadonlyArray<number>>;
  readonly phase: "recording" | "processing";
  readonly startedAt: number | null;
  readonly onStop: () => void;
  readonly onSend: () => void;
}) {
  const waveformColor = useThemeColor("--color-icon");
  return (
    <ComposerCompactRow
      leadingAction={
        <ControlPill
          accessibilityLabel="Stop and append dictation"
          icon="stop.fill"
          onPress={props.onStop}
        />
      }
      trailingAction={
        <ControlPill
          accessibilityLabel="Transcribe and send"
          disabled={props.phase === "processing"}
          icon="arrow.up"
          onPress={props.onSend}
          variant="primary"
        />
      }
    >
      {props.phase === "processing" ? (
        <View className="min-w-0 flex-1 flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color={waveformColor} />
          <Text className="text-sm text-foreground-muted">Transcribing</Text>
        </View>
      ) : (
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <VoiceWaveform color={waveformColor} levels={props.levels} />
          <VoiceElapsedTime startedAt={props.startedAt} />
        </View>
      )}
    </ComposerCompactRow>
  );
}
