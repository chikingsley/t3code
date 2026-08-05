import { isLiquidGlassSupported, LiquidGlassView } from "@callstack/liquid-glass";
import { useEffect, type ReactNode } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { UI_SPACE } from "../lib/ui-metrics";

const COMPOSER_TRANSITION_DURATION = 180;
const COMPOSER_TRANSITION_EASING = Easing.bezier(0.22, 1, 0.36, 1);

export const COMPOSER_LAYOUT_TRANSITION =
  Platform.OS === "android"
    ? undefined
    : LinearTransition.duration(COMPOSER_TRANSITION_DURATION)
        .easing(COMPOSER_TRANSITION_EASING)
        .reduceMotion(ReduceMotion.System);

export const COMPOSER_EXPANDED_SURFACE_STYLE: ViewStyle = {
  borderRadius: 20,
  overflow: "hidden",
  paddingHorizontal: UI_SPACE.control,
  paddingVertical: UI_SPACE.control,
};

export const COMPOSER_COMPACT_SURFACE_STYLE: ViewStyle = {
  alignItems: "center",
  borderRadius: 999,
  flexDirection: "row",
  overflow: "hidden",
  paddingHorizontal: UI_SPACE.inline,
  paddingVertical: UI_SPACE.inline,
};

export function ComposerCompactRow(props: {
  readonly children: ReactNode;
  readonly leadingAction: ReactNode;
  readonly trailingAction: ReactNode;
}) {
  return (
    <View className="min-h-11 min-w-0 flex-1 flex-row items-center gap-2">
      {props.leadingAction}
      <View className="min-w-0 flex-1">{props.children}</View>
      {props.trailingAction}
    </View>
  );
}

/** Shared collapsed/expanded composer surface for thread, draft, and UI-lab states. */
export function ComposerSurface(props: {
  readonly children: ReactNode;
  readonly style: ViewStyle;
  readonly isDarkMode: boolean;
  readonly expanded: boolean;
}) {
  const expansionProgress = useSharedValue(props.expanded ? 1 : 0);
  useEffect(() => {
    expansionProgress.value = withTiming(props.expanded ? 1 : 0, {
      duration: COMPOSER_TRANSITION_DURATION,
      easing: COMPOSER_TRANSITION_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [expansionProgress, props.expanded]);

  const animatedSurfaceStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(expansionProgress.value, [0, 1], [999, 20]),
    paddingHorizontal: interpolate(
      expansionProgress.value,
      [0, 1],
      [UI_SPACE.inline, UI_SPACE.control],
    ),
    paddingVertical: interpolate(
      expansionProgress.value,
      [0, 1],
      [UI_SPACE.inline, UI_SPACE.control],
    ),
  }));

  const shadowStyle: ViewStyle = {
    borderRadius: 27,
    shadowColor: "#000000",
    shadowOpacity: props.isDarkMode ? 0.35 : 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  };

  if (isLiquidGlassSupported) {
    return (
      <Animated.View layout={COMPOSER_LAYOUT_TRANSITION} style={shadowStyle}>
        <LiquidGlassView
          effect="regular"
          interactive
          colorScheme={props.isDarkMode ? "dark" : "light"}
          style={[props.style, animatedSurfaceStyle]}
        >
          {props.children}
        </LiquidGlassView>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={COMPOSER_LAYOUT_TRANSITION} style={shadowStyle}>
      <Animated.View
        style={[
          props.style,
          animatedSurfaceStyle,
          {
            backgroundColor: props.isDarkMode ? "rgba(44,44,46,0.96)" : "rgba(255,255,255,0.96)",
            borderWidth: 1,
            borderColor: props.isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          },
        ]}
      >
        {props.children}
      </Animated.View>
    </Animated.View>
  );
}
