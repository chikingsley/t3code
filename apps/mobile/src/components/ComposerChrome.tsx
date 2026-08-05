import { isLiquidGlassSupported, LiquidGlassView } from "@callstack/liquid-glass";
import type { ReactNode } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import Animated, { Easing, LinearTransition, ReduceMotion } from "react-native-reanimated";

import { UI_SPACE } from "../lib/ui-metrics";

const COMPOSER_TRANSITION_DURATION = 180;
const COMPOSER_TRANSITION_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const AnimatedLiquidGlassView = Animated.createAnimatedComponent(LiquidGlassView);

export const COMPOSER_LAYOUT_TRANSITION =
  Platform.OS === "android"
    ? undefined
    : LinearTransition.duration(COMPOSER_TRANSITION_DURATION)
        .easing(COMPOSER_TRANSITION_EASING)
        .reduceMotion(ReduceMotion.System);

// The wrapper always spans the same width. Keep horizontal padding out of the
// animated style so this transition only reveals the composer's new height.

export const COMPOSER_EXPANDED_SURFACE_STYLE: ViewStyle = {
  borderRadius: 20,
  overflow: "hidden",
  paddingHorizontal: UI_SPACE.inline,
  paddingVertical: UI_SPACE.inline,
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
  const shadowStyle: ViewStyle = {
    borderRadius: props.style.borderRadius,
    shadowColor: "#000000",
    shadowOpacity: props.isDarkMode ? 0.35 : 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  };

  if (isLiquidGlassSupported) {
    return (
      <Animated.View
        accessibilityState={{ expanded: props.expanded }}
        layout={COMPOSER_LAYOUT_TRANSITION}
        style={shadowStyle}
      >
        <AnimatedLiquidGlassView
          effect="regular"
          interactive
          colorScheme={props.isDarkMode ? "dark" : "light"}
          style={props.style}
        >
          {props.children}
        </AnimatedLiquidGlassView>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      accessibilityState={{ expanded: props.expanded }}
      layout={COMPOSER_LAYOUT_TRANSITION}
      style={shadowStyle}
    >
      <Animated.View
        style={[
          props.style,
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
