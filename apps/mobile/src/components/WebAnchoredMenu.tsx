import type { MenuAction, MenuComponentProps } from "@react-native-menu/menu";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";

import { useThemeColor } from "../lib/useThemeColor";
import { cn } from "../lib/cn";
import { SymbolView } from "./AppSymbol";
import { AppText as Text } from "./AppText";
import { OverlayPortal } from "./OverlayPortal";

const MENU_WIDTH = 250;
const SCREEN_MARGIN = 12;
const ANCHOR_GAP = 6;

type Frame = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function WebAnchoredMenu(props: {
  readonly actions: readonly MenuAction[];
  readonly title?: string;
  readonly onPressAction?: MenuComponentProps["onPressAction"];
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: (open: () => void) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<Frame | null>(null);
  const [overlay, setOverlay] = useState<Frame | null>(null);
  const [path, setPath] = useState<readonly MenuAction[]>([]);
  const anchorRef = useRef<View>(null);
  const overlayRef = useRef<View>(null);
  const iconColor = useThemeColor("--color-icon");
  const iconSubtleColor = useThemeColor("--color-icon-subtle");

  const close = useCallback(() => {
    setAnchor(null);
    setOverlay(null);
    setPath([]);
  }, []);

  const open = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }, []);

  const parent = path.at(-1) ?? null;
  const levelActions = (parent?.subactions ?? props.actions).filter(
    (action) => !(action.attributes?.hidden ?? false),
  );
  const local =
    anchor && overlay
      ? {
          x: anchor.x - overlay.x,
          y: anchor.y - overlay.y,
          width: anchor.width,
          height: anchor.height,
        }
      : null;
  const left =
    local && overlay
      ? Math.min(Math.max(local.x, SCREEN_MARGIN), overlay.width - MENU_WIDTH - SCREEN_MARGIN)
      : SCREEN_MARGIN;

  const selectAction = useCallback(
    (action: MenuAction) => {
      if ((action.subactions?.length ?? 0) > 0) {
        setPath((current) => [...current, action]);
        return;
      }
      close();
      if (action.id !== undefined) {
        props.onPressAction?.({
          nativeEvent: { event: action.id },
        } as Parameters<NonNullable<MenuComponentProps["onPressAction"]>>[0]);
      }
    },
    [close, props.onPressAction],
  );

  return (
    <>
      <View ref={anchorRef} collapsable={false} className={props.className} style={props.style}>
        {props.children(open)}
      </View>
      {anchor ? (
        <OverlayPortal>
          <View
            ref={overlayRef}
            className="absolute inset-0"
            collapsable={false}
            onLayout={() => {
              overlayRef.current?.measureInWindow((x, y, width, height) => {
                setOverlay({ x, y, width, height });
              });
            }}
          >
            <Pressable accessible={false} className="absolute inset-0" onPress={close} />
            {local && overlay ? (
              <View
                className="absolute w-[250px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
                style={{
                  bottom: overlay.height - local.y + ANCHOR_GAP,
                  left,
                  maxHeight: Math.max(120, local.y - SCREEN_MARGIN - ANCHOR_GAP),
                }}
              >
                <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
                  {parent ? (
                    <Pressable
                      className="px-3.5 pb-1 pt-2.5"
                      onPress={() => setPath((current) => current.slice(0, -1))}
                      testID="web-anchored-menu-action"
                    >
                      <Text className="text-xs font-t3-bold text-foreground-muted">
                        {parent.title}
                      </Text>
                    </Pressable>
                  ) : props.title ? (
                    <View className="border-b border-border px-3.5 py-2">
                      <Text className="text-center text-xs text-foreground-muted">
                        {props.title}
                      </Text>
                    </View>
                  ) : null}
                  {levelActions.map((action, index) => {
                    const disabled = action.attributes?.disabled ?? false;
                    const hasSubmenu = (action.subactions?.length ?? 0) > 0;
                    return (
                      <Pressable
                        key={action.id ?? `${index}-${action.title}`}
                        accessibilityRole="button"
                        disabled={disabled}
                        testID="web-anchored-menu-action"
                        className={cn(
                          "min-h-11 flex-row items-center gap-2.5 px-3.5 py-2.5 active:bg-subtle",
                          disabled && "opacity-45",
                        )}
                        onPress={() => selectAction(action)}
                      >
                        <View className="min-w-0 flex-1 gap-0.5">
                          <Text className="text-sm font-t3-bold">{action.title}</Text>
                          {action.subtitle ? (
                            <Text className="text-xs text-foreground-muted">{action.subtitle}</Text>
                          ) : null}
                        </View>
                        {hasSubmenu ? (
                          <SymbolView
                            name="chevron.right"
                            size={13}
                            tintColor={iconSubtleColor}
                            type="monochrome"
                          />
                        ) : action.state === "on" ? (
                          <SymbolView
                            name="checkmark"
                            size={15}
                            tintColor={iconColor}
                            type="monochrome"
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </OverlayPortal>
      ) : null}
    </>
  );
}
