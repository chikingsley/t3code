import { useId } from "react";
import { View, type ColorValue, type LayoutChangeEvent } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import {
  WAVEFORM_BAR_GAP,
  WAVEFORM_BAR_WIDTH,
  waveformPointCountForWidth,
} from "./waveform-levels";

const BAR_PITCH = WAVEFORM_BAR_WIDTH + WAVEFORM_BAR_GAP;
const TRACK_HEIGHT = 36;
const MAX_BAR_HEIGHT = 28;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function waveformPath(input: {
  readonly leftInset: number;
  readonly pointCount: number;
  readonly centerY: number;
  readonly levels?: ReadonlyArray<number>;
  readonly levelStart?: number;
  readonly firstSlot?: number;
}): string {
  "worklet";
  let path = "";
  for (let index = 0; index < input.pointCount; index += 1) {
    const level = input.levels?.[(input.levelStart ?? 0) + index];
    const height = level === undefined ? 0.01 : Math.max(3, Math.round(level * MAX_BAR_HEIGHT));
    const slot = (input.firstSlot ?? 0) + index;
    const x = input.leftInset + slot * BAR_PITCH + WAVEFORM_BAR_WIDTH / 2;
    path += `M${x},${input.centerY - height / 2}V${input.centerY + height / 2}`;
  }
  return path;
}

export function VoiceWaveform(props: {
  readonly levels: SharedValue<ReadonlyArray<number>>;
  readonly color: ColorValue;
}) {
  const trackWidth = useSharedValue(0);
  const gradientId = `voice-waveform-${useId().replaceAll(":", "")}`;
  const trackAnimatedProps = useAnimatedProps(() => {
    const width = trackWidth.value;
    const pointCount = waveformPointCountForWidth(width);
    const usedWidth = pointCount * WAVEFORM_BAR_WIDTH + (pointCount - 1) * WAVEFORM_BAR_GAP;
    return {
      d: waveformPath({
        centerY: TRACK_HEIGHT / 2,
        leftInset: Math.max(0, (width - usedWidth) / 2),
        pointCount,
      }),
    };
  });
  const animatedProps = useAnimatedProps(() => {
    const width = trackWidth.value;
    const visiblePointCount = waveformPointCountForWidth(width);
    const samples = props.levels.value;
    const visibleSampleCount = Math.min(samples.length, visiblePointCount);
    const firstSampleIndex = samples.length - visibleSampleCount;
    const firstSlot = visiblePointCount - visibleSampleCount;
    const usedWidth =
      visiblePointCount * WAVEFORM_BAR_WIDTH + (visiblePointCount - 1) * WAVEFORM_BAR_GAP;
    const leftInset = Math.max(0, (width - usedWidth) / 2);
    const centerY = TRACK_HEIGHT / 2;
    return {
      d: waveformPath({
        centerY,
        firstSlot,
        leftInset,
        levels: samples,
        levelStart: firstSampleIndex,
        pointCount: visibleSampleCount,
      }),
    };
  });
  const handleLayout = (event: LayoutChangeEvent) => {
    trackWidth.value = event.nativeEvent.layout.width;
  };

  return (
    <View
      accessibilityLabel="Live microphone level"
      accessibilityRole="image"
      className="h-9 min-w-0 flex-1 overflow-hidden"
      onLayout={handleLayout}
    >
      <Svg height={TRACK_HEIGHT} width="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0%" x2="12%" y1="0%" y2="0%">
            <Stop offset="0%" stopColor={props.color} stopOpacity={0} />
            <Stop offset="100%" stopColor={props.color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <AnimatedPath
          animatedProps={trackAnimatedProps}
          fill="none"
          stroke={props.color}
          strokeLinecap="round"
          strokeOpacity={0.24}
          strokeWidth={WAVEFORM_BAR_WIDTH}
        />
        <AnimatedPath
          animatedProps={animatedProps}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeWidth={WAVEFORM_BAR_WIDTH}
        />
      </Svg>
    </View>
  );
}
