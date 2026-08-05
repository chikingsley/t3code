import type { ComponentProps, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useColorScheme,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useThemeColor } from "../lib/useThemeColor";
import { UI_CONTROL, UI_SPACE } from "../lib/ui-metrics";
import { cn } from "../lib/cn";
import { AppText as Text } from "./AppText";
import { SymbolView } from "./AppSymbol";

export const COMPOSER_TOOLBAR_CONTROL_HEIGHT = UI_CONTROL.standard;
export const COMPOSER_TOOLBAR_GAP = UI_SPACE.compact;
export const COMPOSER_TOOLBAR_FADE_WIDTH = UI_SPACE.gutter;
const COMPOSER_TOOLBAR_SCROLL_EPSILON = UI_SPACE.inline;

export function ComposerToolbarRow(props: {
  readonly children: ReactNode;
  readonly paddingBottom?: number;
  readonly paddingHorizontal?: number;
  readonly paddingTop?: number;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      className="flex-row items-center gap-1"
      style={[
        {
          paddingBottom: props.paddingBottom ?? UI_SPACE.compact,
          paddingHorizontal: props.paddingHorizontal ?? UI_SPACE.compact,
          paddingTop: props.paddingTop ?? UI_SPACE.compact,
        },
        props.style,
      ]}
    >
      {props.children}
    </View>
  );
}

export function ComposerToolbarScroller(props: {
  readonly children: ReactNode;
  readonly fadeOpaque: string;
  readonly fadeTransparent: string;
  readonly contentPaddingRight?: number;
}) {
  const [metrics, setMetrics] = useState({
    contentWidth: 0,
    offsetX: 0,
    viewportWidth: 0,
  });

  const scrollEdges = useMemo(() => {
    const maxOffset = Math.max(0, metrics.contentWidth - metrics.viewportWidth);
    return {
      showLeftFade: metrics.offsetX > COMPOSER_TOOLBAR_SCROLL_EPSILON,
      showRightFade: metrics.offsetX < maxOffset - COMPOSER_TOOLBAR_SCROLL_EPSILON,
    };
  }, [metrics]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const viewportWidth = event.nativeEvent.layout.width;
    setMetrics((current) =>
      current.viewportWidth === viewportWidth ? current : { ...current, viewportWidth },
    );
  }, []);

  const handleContentSizeChange = useCallback((contentWidth: number) => {
    setMetrics((current) =>
      current.contentWidth === contentWidth ? current : { ...current, contentWidth },
    );
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    setMetrics((current) =>
      Math.abs(current.offsetX - offsetX) < 1 ? current : { ...current, offsetX },
    );
  }, []);

  return (
    <View className="relative min-w-0 flex-1 overflow-hidden">
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: "center",
          gap: COMPOSER_TOOLBAR_GAP,
          paddingLeft: 0,
          paddingRight: props.contentPaddingRight ?? 1,
        }}
      >
        {props.children}
      </ScrollView>
      {scrollEdges.showLeftFade ? (
        <View
          pointerEvents="none"
          style={{
            bottom: 0,
            experimental_backgroundImage: `linear-gradient(to right, ${props.fadeOpaque} 0%, ${props.fadeTransparent} 100%)`,
            left: 0,
            position: "absolute",
            top: 0,
            width: COMPOSER_TOOLBAR_FADE_WIDTH,
          }}
        />
      ) : null}
      {scrollEdges.showRightFade ? (
        <View
          pointerEvents="none"
          style={{
            bottom: 0,
            experimental_backgroundImage: `linear-gradient(to right, ${props.fadeTransparent} 0%, ${props.fadeOpaque} 100%)`,
            position: "absolute",
            right: 0,
            top: 0,
            width: COMPOSER_TOOLBAR_FADE_WIDTH,
          }}
        />
      ) : null}
    </View>
  );
}

export function ComposerToolbarButton(props: {
  readonly icon?: ComponentProps<typeof SymbolView>["name"];
  readonly iconNode?: ReactNode;
  readonly label?: string;
  readonly accessibilityLabel?: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly maxWidth?: number;
  readonly minWidth?: number;
  readonly onPress?: () => void;
  readonly showChevron?: boolean;
  readonly textTransform?: "none" | "uppercase";
  readonly variant?: "bare" | "default" | "primary" | "danger";
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const isDarkMode = useColorScheme() === "dark";
  const iconColor = useThemeColor("--color-icon");
  const iconSubtle = useThemeColor("--color-icon-subtle");
  const primaryFg = useThemeColor("--color-primary-foreground");
  const dangerFg = useThemeColor("--color-danger-foreground");
  const variant = props.variant ?? "default";
  const isCircle = !props.label && props.showChevron === false;
  const defaultBorderColor = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const activeBorderColor = isDarkMode ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.1)";
  const filledBorderColor =
    variant === "danger"
      ? "rgba(255,255,255,0.14)"
      : props.disabled
        ? defaultBorderColor
        : "rgba(255,255,255,0.18)";
  const iconTintColor =
    variant === "primary"
      ? props.disabled
        ? iconSubtle
        : primaryFg
      : variant === "danger"
        ? dangerFg
        : iconColor;

  return (
    <Pressable
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      className={cn(
        "h-ui-control flex-row items-center justify-center rounded-full active:opacity-70",
        isCircle ? "w-ui-control" : "gap-2 px-3",
        variant === "bare"
          ? "bg-transparent"
          : variant === "primary"
            ? props.disabled
              ? "bg-subtle-strong"
              : "bg-primary"
            : variant === "danger"
              ? "bg-danger"
              : props.active
                ? "bg-subtle-strong"
                : "bg-transparent",
        props.className,
      )}
      style={({ pressed }) => [
        {
          borderColor:
            variant === "bare"
              ? "transparent"
              : variant === "default"
                ? props.active
                  ? activeBorderColor
                  : defaultBorderColor
                : filledBorderColor,
          borderWidth: variant === "danger" ? 1 : 0,
          maxWidth: props.maxWidth,
          minWidth: props.minWidth,
          opacity: props.disabled ? 0.55 : pressed ? 0.72 : 1,
          shadowOpacity: 0,
        },
        props.style,
      ]}
    >
      {props.iconNode ? (
        <View className="h-ui-icon w-ui-icon items-center justify-center">{props.iconNode}</View>
      ) : props.icon ? (
        <SymbolView
          name={props.icon}
          size={UI_CONTROL.icon}
          tintColor={iconTintColor}
          type="monochrome"
          weight={props.icon === "arrow.up" ? "bold" : undefined}
        />
      ) : null}
      {props.label ? (
        <Text
          className={cn(
            "shrink text-center text-sm font-t3-bold",
            variant === "primary"
              ? props.disabled
                ? "text-foreground-muted"
                : "text-primary-foreground"
              : "text-foreground",
          )}
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{ textTransform: props.textTransform ?? "none" }}
        >
          {props.label}
        </Text>
      ) : null}
      {props.showChevron === false ? null : (
        <SymbolView
          name="chevron.down"
          size={UI_CONTROL.chevron}
          tintColor={iconTintColor}
          type="monochrome"
        />
      )}
    </Pressable>
  );
}

export const ComposerToolbarTrigger = ComposerToolbarButton;
