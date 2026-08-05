import type {
  EnvironmentId,
  MessageId,
  ModelSelection,
  OrchestrationThreadShell,
  ProviderInteractionMode,
  RuntimeMode,
  ServerConfig as T3ServerConfig,
} from "@t3tools/contracts";
import {
  detectComposerTrigger,
  replaceTextRange,
  serializeComposerFileLink,
  type ComposerTrigger,
} from "@t3tools/shared/composerTrigger";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  useColorScheme,
  View,
} from "react-native";
import ImageViewing from "../../components/ImageViewing";
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from "react-native-reanimated";
import { useThemeColor } from "../../lib/useThemeColor";
import { armAgentAwarenessLiveActivityForLocalWork } from "../agent-awareness/remoteRegistration";
import { scopedThreadKey } from "../../lib/scopedEntities";

import { AppText as Text } from "../../components/AppText";
import { AutoGrowingComposerEditor } from "../../components/AutoGrowingComposerEditor";
import { ComposerAttachmentStrip } from "../../components/ComposerAttachmentStrip";
import {
  COMPOSER_COMPACT_SURFACE_STYLE,
  COMPOSER_EXPANDED_SURFACE_STYLE,
  ComposerSurface,
} from "../../components/ComposerChrome";
import {
  type ComposerEditorHandle,
  type ComposerEditorSelection,
} from "../../components/ComposerEditor";
import {
  ComposerToolbarButton,
  ComposerToolbarRow,
  ComposerToolbarScroller,
  ComposerToolbarTrigger,
} from "../../components/ComposerToolbarTrigger";
import { ControlPill, ControlPillMenu } from "../../components/ControlPill";
import { ProviderIcon } from "../../components/ProviderIcon";
import { useRealtimeDictation } from "../voice/use-realtime-dictation";
import { VoiceComposerRow } from "../voice/VoiceComposerRow";
import type { DraftComposerImageAttachment } from "../../lib/composerImages";
import { buildModelMenuActions, buildModelOptions, groupByProvider } from "../../lib/modelOptions";
import { useScaledTextRole } from "../settings/appearance/useScaledTextRole";
import type { RemoteClientConnectionState } from "../../lib/connection";
import {
  insertRankedSearchResult,
  normalizeSearchQuery,
  scoreQueryMatch,
} from "@t3tools/shared/searchRanking";
import {
  applyProviderOptionMenuEvent,
  buildComposerConfigurationMenuActions,
  providerOptionsConfigurationLabel,
  resolveProviderOptionDescriptors,
} from "../../lib/providerOptions";
import { useComposerPathSearch } from "../../state/use-composer-path-search";
import { ComposerCommandPopover, type ComposerCommandItem } from "./ComposerCommandPopover";
import { insertDictationAtSelection } from "./dictationInsertion";

/**
 * Height of the collapsed composer (pill + vertical padding, excluding safe-area inset).
 * Exported so the parent can compute feed overlap / content insets.
 */
export const COMPOSER_COLLAPSED_CHROME = 60;

/**
 * Height of the expanded composer (card + toolbar + vertical padding, excluding safe-area inset).
 * Used by the parent to compute the larger feed bottom inset when the composer is focused.
 */
export const COMPOSER_EXPANDED_CHROME = 174;

export interface ThreadComposerProps {
  readonly colorScheme?: "light" | "dark";
  readonly draftMessage: string;
  readonly draftAttachments: ReadonlyArray<DraftComposerImageAttachment>;
  readonly placeholder: string;
  readonly contentMaxWidth?: number;
  readonly bottomInset?: number;
  readonly connectionState: RemoteClientConnectionState;
  readonly connectionError: string | null;
  readonly environmentLabel: string | null;
  /**
   * Message sync phase for the selected thread (drives the status pill):
   * "loading" = first fetch, nothing to show yet; "syncing" = cached messages
   * are on screen while they reconcile with the server.
   */
  readonly threadSyncPhase?: "loading" | "syncing" | null;
  readonly selectedThread: OrchestrationThreadShell;
  readonly serverConfig: Pick<T3ServerConfig, "providers"> | null;
  readonly queueCount: number;
  readonly activeThreadBusy: boolean;
  readonly environmentId: EnvironmentId;
  readonly projectCwd: string | null;
  readonly editorRef?: RefObject<ComposerEditorHandle | null>;
  readonly onChangeDraftMessage: (value: string) => void;
  readonly onPickDraftImages: () => Promise<void>;
  readonly onNativePasteImages: (uris: ReadonlyArray<string>) => Promise<void>;
  readonly onRemoveDraftImage: (imageId: string) => void;
  readonly onStopThread: () => void;
  readonly onSendMessage: () => Promise<MessageId | null>;
  readonly onUpdateModelSelection: (modelSelection: ModelSelection) => void;
  readonly onUpdateRuntimeMode: (runtimeMode: RuntimeMode) => void;
  readonly onUpdateInteractionMode: (interactionMode: ProviderInteractionMode) => void;
  readonly onReconnectEnvironment: () => void;
  readonly onExpandedChange?: (expanded: boolean) => void;
  readonly presentationState?: "automatic" | "compact" | "expanded";
}

type ComposerStatusPillState = {
  readonly kind: "unavailable" | "reconnecting" | "syncing";
  readonly label: string;
};

function composerConnectionStatus(input: {
  readonly connectionError: string | null;
  readonly connectionState: RemoteClientConnectionState;
  readonly environmentLabel: string | null;
  readonly threadSyncPhase?: "loading" | "syncing" | null;
}): ComposerStatusPillState | null {
  const environmentLabel = input.environmentLabel ?? "Environment";

  switch (input.connectionState) {
    case "connecting":
    case "reconnecting":
      return {
        kind: "reconnecting",
        label:
          input.connectionError === null
            ? `Reconnecting to ${environmentLabel}...`
            : `Failed to connect. Retrying ${environmentLabel}...`,
      };
    case "offline":
      return { kind: "unavailable", label: "You are offline" };
    case "error":
      return {
        kind: "unavailable",
        label: input.connectionError
          ? `Failed to connect to ${environmentLabel}: ${input.connectionError}`
          : `Failed to connect to ${environmentLabel}`,
      };
    case "available":
      return { kind: "unavailable", label: `${environmentLabel} is not connected` };
    case "connected":
      break;
  }

  // Connected: the pill is the single loading/sync indicator. One stable
  // label per open — "Loading" when starting from scratch, "Syncing" when
  // cached messages are already visible.
  switch (input.threadSyncPhase) {
    case "loading":
      return { kind: "syncing", label: "Loading messages..." };
    case "syncing":
      return { kind: "syncing", label: "Syncing messages..." };
    default:
      return null;
  }
}

const ComposerConnectionStatusPill = memo(function ComposerConnectionStatusPill(props: {
  readonly onPress: () => void;
  readonly status: ComposerStatusPillState;
}) {
  const isReconnecting = props.status.kind !== "unavailable";

  return (
    <Animated.View
      className="absolute inset-x-0 bottom-full items-center pb-2"
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        onPress={props.onPress}
        className="max-w-full flex-row items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-sm active:opacity-70 dark:bg-neutral-900/90"
      >
        {isReconnecting ? (
          <ActivityIndicator size="small" color="#8e8e93" />
        ) : (
          <View className="h-2 w-2 rounded-full bg-red-500" />
        )}
        <Text
          className="max-w-[260px] text-sm font-t3-bold leading-snug text-foreground"
          numberOfLines={1}
        >
          {props.status.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

export const ThreadComposer = memo(function ThreadComposer(props: ThreadComposerProps) {
  const systemColorScheme = useColorScheme();
  const isDarkMode = (props.colorScheme ?? systemColorScheme) === "dark";
  const foregroundColor = useThemeColor("--color-foreground");
  const bodyText = useScaledTextRole("body");
  const fallbackInputRef = useRef<ComposerEditorHandle>(null);
  const inputRef = props.editorRef ?? fallbackInputRef;
  const [isAutomaticallyExpanded, setIsAutomaticallyExpanded] = useState(false);
  const wasExpandedBeforePreviewRef = useRef(false);
  const inFlightThreadIdsRef = useRef(new Set<string>());
  const { onExpandedChange } = props;
  const dictation = useRealtimeDictation();
  const alertedDictationErrorRef = useRef<string | null>(null);
  const dictationActive = dictation.phase !== "idle" && dictation.phase !== "failed";

  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const hasContent = props.draftMessage.trim().length > 0 || props.draftAttachments.length > 0;
  const presentationState = props.presentationState ?? "automatic";
  const isExpanded =
    presentationState === "expanded" ||
    (presentationState === "automatic" && isAutomaticallyExpanded);
  const showExpandedComposer = isExpanded && !dictationActive;
  const canSend = hasContent;

  const onPressImage = useCallback(
    (uri: string) => {
      wasExpandedBeforePreviewRef.current = isExpanded;
      setPreviewImageUri(uri);
    },
    [isExpanded],
  );

  const closePreview = useCallback(() => {
    setPreviewImageUri(null);
    if (wasExpandedBeforePreviewRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputRef]);

  const handleFocus = useCallback(() => {
    setIsAutomaticallyExpanded(true);
    onExpandedChange?.(true);
  }, [onExpandedChange]);

  const collapseComposer = useCallback(() => {
    setIsAutomaticallyExpanded(false);
    inputRef.current?.blur();
    onExpandedChange?.(false);
  }, [inputRef, onExpandedChange]);

  useEffect(() => {
    const message = dictation.errorMessage;
    if (!message || alertedDictationErrorRef.current === message) return;
    alertedDictationErrorRef.current = message;
    Alert.alert("Dictation unavailable", message);
  }, [dictation.errorMessage]);
  const showStopAction =
    props.selectedThread.session?.status === "running" ||
    props.selectedThread.session?.status === "starting";

  const sendLabel =
    props.connectionState !== "connected" || props.activeThreadBusy || props.queueCount > 0
      ? "Queue"
      : "Send";
  const currentModelSelection = props.selectedThread.modelSelection;
  const currentRuntimeMode = props.selectedThread.runtimeMode;
  const currentInteractionMode = props.selectedThread.interactionMode ?? "default";
  const connectionStatus = composerConnectionStatus({
    connectionError: props.connectionError,
    connectionState: props.connectionState,
    environmentLabel: props.environmentLabel,
    threadSyncPhase: props.threadSyncPhase,
  });
  const toolbarFadeOpaque = isDarkMode ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.95)";
  const toolbarFadeTransparent = isDarkMode ? "rgba(0,0,0,0)" : "rgba(255,255,255,0)";
  const selectedProviderStatus = useMemo(() => {
    if (!props.serverConfig) return null;
    return (
      props.serverConfig.providers.find(
        (p) => p.instanceId === props.selectedThread.modelSelection.instanceId,
      ) ?? null
    );
  }, [props.serverConfig, props.selectedThread.modelSelection.instanceId]);
  const showInteractionModeToggle = selectedProviderStatus?.showInteractionModeToggle ?? false;

  // ── Trigger detection ────────────────────────────────────
  const [composerSelection, setComposerSelection] = useState(() => ({
    start: props.draftMessage.length,
    end: props.draftMessage.length,
  }));

  const handleSelectionChange = useCallback((selection: ComposerEditorSelection) => {
    setComposerSelection(selection);
  }, []);
  useEffect(() => {
    const end = props.draftMessage.length;
    setComposerSelection((selection) => {
      const start = Math.min(selection.start, end);
      const selectionEnd = Math.min(selection.end, end);
      if (start === selection.start && selectionEnd === selection.end) {
        return selection;
      }
      return { start, end: selectionEnd };
    });
  }, [props.draftMessage.length]);

  const composerTrigger = useMemo<ComposerTrigger | null>(() => {
    if (composerSelection.start !== composerSelection.end) {
      return null;
    }
    return detectComposerTrigger(props.draftMessage, composerSelection.end);
  }, [composerSelection, props.draftMessage]);
  const pathSearch = useComposerPathSearch({
    environmentId: props.environmentId,
    cwd: composerTrigger?.kind === "path" ? props.projectCwd : null,
    query: composerTrigger?.kind === "path" ? composerTrigger.query : null,
  });

  const composerMenuItems: ComposerCommandItem[] = useMemo(() => {
    if (!composerTrigger) return [];

    if (composerTrigger.kind === "slash-command") {
      const q = composerTrigger.query.toLowerCase();
      const allBuiltIn = [
        {
          id: "cmd:model",
          type: "slash-command" as const,
          command: "model",
          label: "/model",
          description: "Switch model",
        },
        {
          id: "cmd:plan",
          type: "slash-command" as const,
          command: "plan",
          label: "/plan",
          description: "Switch to plan mode",
        },
        {
          id: "cmd:default",
          type: "slash-command" as const,
          command: "default",
          label: "/default",
          description: "Switch to default mode",
        },
      ];
      const builtIn = allBuiltIn.filter((item) => item.command.includes(q));

      const providerCommands: ComposerCommandItem[] = [];
      for (const cmd of selectedProviderStatus?.slashCommands ?? []) {
        if (!cmd.name.toLowerCase().includes(q)) continue;
        providerCommands.push({
          id: `pcmd:${cmd.name}`,
          type: "provider-slash-command" as const,
          command: cmd,
          label: `/${cmd.name}`,
          description: cmd.description ?? "",
        });
      }

      return [...builtIn, ...providerCommands];
    }

    if (composerTrigger.kind === "skill") {
      const enabledSkills = (selectedProviderStatus?.skills ?? []).filter((s) => s.enabled);
      const normalizedQuery = normalizeSearchQuery(composerTrigger.query, {
        trimLeadingPattern: /^\$+/,
      });

      if (!normalizedQuery) {
        return enabledSkills.slice(0, 20).map((skill) => ({
          id: `skill:${skill.name}`,
          type: "skill" as const,
          skill,
          label: skill.displayName ?? skill.name,
          description: skill.shortDescription ?? skill.description ?? "",
        }));
      }

      const ranked: Array<{
        item: (typeof enabledSkills)[number];
        score: number;
        tieBreaker: string;
      }> = [];
      for (const skill of enabledSkills) {
        const displayLabel = (skill.displayName ?? skill.name).toLowerCase();
        const scores = [
          scoreQueryMatch({
            value: skill.name.toLowerCase(),
            query: normalizedQuery,
            exactBase: 0,
            prefixBase: 2,
            boundaryBase: 4,
            includesBase: 6,
            fuzzyBase: 100,
            boundaryMarkers: ["-", "_", "/"],
          }),
          scoreQueryMatch({
            value: displayLabel,
            query: normalizedQuery,
            exactBase: 1,
            prefixBase: 3,
            boundaryBase: 5,
            includesBase: 7,
            fuzzyBase: 110,
          }),
          scoreQueryMatch({
            value: skill.shortDescription?.toLowerCase() ?? "",
            query: normalizedQuery,
            exactBase: 20,
            prefixBase: 22,
            boundaryBase: 24,
            includesBase: 26,
          }),
          scoreQueryMatch({
            value: skill.description?.toLowerCase() ?? "",
            query: normalizedQuery,
            exactBase: 30,
            prefixBase: 32,
            boundaryBase: 34,
            includesBase: 36,
          }),
        ].filter((s): s is number => s !== null);

        if (scores.length > 0) {
          insertRankedSearchResult(
            ranked,
            {
              item: skill,
              score: Math.min(...scores),
              tieBreaker: `${displayLabel}\u0000${skill.name}`,
            },
            20,
          );
        }
      }

      return ranked.map(({ item: skill }) => ({
        id: `skill:${skill.name}`,
        type: "skill" as const,
        skill,
        label: skill.displayName ?? skill.name,
        description: skill.shortDescription ?? skill.description ?? "",
      }));
    }

    if (composerTrigger.kind === "path") {
      return pathSearch.entries.map((entry) => {
        const parts = entry.path.split("/");
        return {
          id: `path:${entry.path}`,
          type: "path" as const,
          path: entry.path,
          kind: entry.kind,
          label: parts[parts.length - 1] ?? entry.path,
          description: parts.length > 1 ? parts.slice(0, -1).join("/") : "",
        };
      });
    }

    return [];
  }, [composerTrigger, pathSearch.entries, selectedProviderStatus]);

  // ── Handle command selection ──────────────────────────────
  const { onChangeDraftMessage, onUpdateInteractionMode, draftMessage, onSendMessage } = props;

  const handleSend = useCallback(async () => {
    const threadKey = scopedThreadKey(props.environmentId, props.selectedThread.id);
    if (inFlightThreadIdsRef.current.has(threadKey)) return;
    inFlightThreadIdsRef.current.add(threadKey);
    try {
      await onSendMessage();
      // Sending a prompt starts agent work: arm the lock-screen card while the
      // app is foregrounded and the activity token can be registered. Armed
      // after the send so its preference read and native Activity start don't
      // contend with the queued-message feedback on the tap frame.
      armAgentAwarenessLiveActivityForLocalWork({
        threadTitle: props.selectedThread.title,
        projectTitle: props.environmentLabel ?? "T3 Code",
      });
    } finally {
      inFlightThreadIdsRef.current.delete(threadKey);
    }
  }, [
    onSendMessage,
    props.environmentId,
    props.environmentLabel,
    props.selectedThread.id,
    props.selectedThread.title,
  ]);
  const handleCommitDictation = useCallback(
    (text: string) => {
      const result = insertDictationAtSelection({
        draft: draftMessage,
        selection: composerSelection,
        transcript: text,
      });
      setComposerSelection(result.selection);
      onChangeDraftMessage(result.text);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelection(result.selection);
      });
    },
    [composerSelection, draftMessage, inputRef, onChangeDraftMessage],
  );
  const startDictation = useCallback(async () => {
    inputRef.current?.blur();
    await dictation.start();
  }, [dictation, inputRef]);
  const finishDictation = useCallback(
    async (send: boolean) => {
      const result = await dictation.stop();
      if (result.text.length === 0) return;
      handleCommitDictation(result.text);
      if (send) await handleSend();
    },
    [dictation, handleCommitDictation, handleSend],
  );
  const handleCommandSelect = useCallback(
    (item: ComposerCommandItem) => {
      if (!composerTrigger) return;

      if (
        item.type === "slash-command" &&
        (item.command === "plan" || item.command === "default")
      ) {
        const result = replaceTextRange(
          draftMessage,
          composerTrigger.rangeStart,
          composerTrigger.rangeEnd,
          "",
        );
        setComposerSelection({ start: result.cursor, end: result.cursor });
        onChangeDraftMessage(result.text);
        onUpdateInteractionMode(item.command);
        return;
      }

      let replacement = "";
      if (item.type === "path") {
        replacement = `${serializeComposerFileLink(item.path)} `;
      } else if (item.type === "skill") {
        replacement = `$${item.skill.name} `;
      } else if (item.type === "slash-command") {
        replacement = `/${item.command} `;
      } else if (item.type === "provider-slash-command") {
        replacement = `/${item.command.name} `;
      }

      const result = replaceTextRange(
        draftMessage,
        composerTrigger.rangeStart,
        composerTrigger.rangeEnd,
        replacement,
      );
      setComposerSelection({ start: result.cursor, end: result.cursor });
      onChangeDraftMessage(result.text);
    },
    [composerTrigger, draftMessage, onChangeDraftMessage, onUpdateInteractionMode],
  );

  // ── Model menu ───────────────────────────────────────────
  const modelOptions = useMemo(
    () => buildModelOptions(props.serverConfig, currentModelSelection),
    [props.serverConfig, currentModelSelection],
  );
  const providerGroups = useMemo(() => groupByProvider(modelOptions), [modelOptions]);
  const currentModelOption =
    modelOptions.find(
      (option) =>
        option.selection.instanceId === currentModelSelection.instanceId &&
        option.selection.model === currentModelSelection.model,
    ) ?? null;
  const providerOptionDescriptors = useMemo(
    () =>
      resolveProviderOptionDescriptors({
        capabilities: currentModelOption?.capabilities,
        selections: currentModelSelection.options,
      }),
    [currentModelOption?.capabilities, currentModelSelection.options],
  );
  const configurationLabel = useMemo(
    () => providerOptionsConfigurationLabel(providerOptionDescriptors),
    [providerOptionDescriptors],
  );
  const modelMenuActions = useMemo(
    () => buildModelMenuActions(providerGroups, currentModelSelection),
    [providerGroups, currentModelSelection],
  );

  // ── Options menu ─────────────────────────────────────────
  const optionsMenuActions = useMemo(
    () =>
      buildComposerConfigurationMenuActions({
        descriptors: providerOptionDescriptors,
        runtimeMode: currentRuntimeMode,
        interactionMode: currentInteractionMode,
        showInteractionModeToggle,
      }),
    [
      currentInteractionMode,
      currentRuntimeMode,
      providerOptionDescriptors,
      showInteractionModeToggle,
    ],
  );

  // ── Menu handlers ────────────────────────────────────────
  function handleModelMenuAction(event: string) {
    if (!event.startsWith("model:")) {
      return;
    }
    const modelKey = event.slice("model:".length);
    const option = modelOptions.find((o) => o.key === modelKey);
    if (option) {
      props.onUpdateModelSelection(option.selection);
    }
  }

  function handleOptionsMenuAction(event: string) {
    const providerOptions = applyProviderOptionMenuEvent(providerOptionDescriptors, event);
    if (providerOptions) {
      props.onUpdateModelSelection({
        ...currentModelSelection,
        options: providerOptions,
      });
      return;
    }
    if (event.startsWith("options:runtime:")) {
      const runtimeMode = event.slice("options:runtime:".length) as RuntimeMode;
      props.onUpdateRuntimeMode(runtimeMode);
      return;
    }
    if (event.startsWith("options:interaction:")) {
      const interactionMode = event.slice("options:interaction:".length) as ProviderInteractionMode;
      props.onUpdateInteractionMode(interactionMode);
    }
  }

  return (
    <View
      className="px-4"
      style={{
        paddingTop: isExpanded ? 8 : 6,
        paddingBottom: (props.bottomInset ?? 0) + (isExpanded ? 8 : 6),
        experimental_backgroundImage: isDarkMode
          ? "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.9) 100%)"
          : "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 55%, rgba(255,255,255,0.9) 100%)",
      }}
    >
      <View className="relative w-full self-center" style={{ maxWidth: props.contentMaxWidth }}>
        {composerTrigger && composerMenuItems.length > 0 ? (
          <View className="absolute inset-x-0 bottom-full z-10 mb-2">
            <ComposerCommandPopover
              items={composerMenuItems}
              triggerKind={composerTrigger.kind}
              isLoading={pathSearch.isPending}
              onSelect={handleCommandSelect}
            />
          </View>
        ) : null}

        {connectionStatus ? (
          <ComposerConnectionStatusPill
            status={connectionStatus}
            onPress={props.onReconnectEnvironment}
          />
        ) : null}

        <ComposerSurface
          expanded={showExpandedComposer}
          isDarkMode={isDarkMode}
          style={
            showExpandedComposer ? COMPOSER_EXPANDED_SURFACE_STYLE : COMPOSER_COMPACT_SURFACE_STYLE
          }
        >
          {/* Attachment strip — inside the card, above the text input */}
          {showExpandedComposer ? (
            <View className={props.draftAttachments.length > 0 ? "pb-2.5" : undefined}>
              <ComposerAttachmentStrip
                attachments={props.draftAttachments}
                onRemove={props.onRemoveDraftImage}
                onPressImage={onPressImage}
              />
            </View>
          ) : null}

          {!showExpandedComposer && !dictationActive ? (
            <ControlPill
              accessibilityLabel="Add attachment"
              icon="plus"
              onPress={() => void props.onPickDraftImages()}
              variant="bare"
            />
          ) : null}

          {dictationActive ? (
            <VoiceComposerRow
              levels={dictation.waveformLevels}
              onSend={() => void finishDictation(true)}
              onStop={() => void finishDictation(false)}
              phase={dictation.phase === "processing" ? "processing" : "recording"}
              startedAt={dictation.startedAt}
            />
          ) : (
            <View
              className={
                showExpandedComposer ? "min-w-0 flex-row items-start" : "relative min-w-0 flex-1"
              }
              style={showExpandedComposer ? undefined : { paddingLeft: 13 }}
            >
              <View className="min-w-0 flex-1">
                <AutoGrowingComposerEditor
                  ref={inputRef}
                  multiline={showExpandedComposer}
                  value={props.draftMessage}
                  skills={selectedProviderStatus?.skills ?? []}
                  selection={composerSelection}
                  onChangeText={props.onChangeDraftMessage}
                  onSelectionChange={handleSelectionChange}
                  onPasteImages={(uris) => void props.onNativePasteImages(uris)}
                  placeholder={props.placeholder}
                  onFocus={handleFocus}
                  onSubmit={handleSend}
                  // Android: collapsed single line centers natively (gravity) in
                  // a pill-height box matching the send button; iOS keeps insets.
                  singleLineCentered={!showExpandedComposer}
                  contentInsetVertical={showExpandedComposer || Platform.OS === "android" ? 0 : 6}
                  maximumLineCount={showExpandedComposer ? 3 : 1}
                  minimumLineCount={1}
                  style={
                    showExpandedComposer
                      ? { paddingHorizontal: 4, paddingVertical: 0 }
                      : { minWidth: 0, paddingVertical: 0, width: "100%" }
                  }
                  textStyle={{
                    ...bodyText,
                    color: foregroundColor,
                  }}
                />
              </View>
              {showExpandedComposer && presentationState === "automatic" ? (
                <View>
                  <ComposerToolbarButton
                    accessibilityLabel="Minimize composer"
                    className="-mr-1 -mt-1 h-ui-control w-ui-control"
                    icon="xmark"
                    onPress={collapseComposer}
                    showChevron={false}
                  />
                </View>
              ) : null}
            </View>
          )}
          {!showExpandedComposer && !dictationActive && props.draftAttachments.length > 0 ? (
            <View className="flex-row gap-1 pl-1">
              {props.draftAttachments.slice(0, 3).map((image) => (
                <Pressable key={image.id} onPress={() => onPressImage(image.previewUri)}>
                  <Image
                    source={{ uri: image.previewUri }}
                    className="size-[30px] rounded-lg bg-subtle"
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
              {props.draftAttachments.length > 3 ? (
                <View className="size-[30px] items-center justify-center rounded-lg bg-subtle-strong">
                  <Text className="text-foreground-muted text-2xs font-t3-bold">
                    +{props.draftAttachments.length - 3}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {!showExpandedComposer && !dictationActive ? (
            <>
              <ControlPill
                accessibilityLabel="Dictate with microphone"
                icon="mic.fill"
                onPress={() => void startDictation()}
                variant="bare"
              />
              <View>
                {showStopAction ? (
                  <ControlPill
                    accessibilityLabel="Stop"
                    icon="stop.fill"
                    variant="danger"
                    onPress={props.onStopThread}
                  />
                ) : (
                  <ControlPill
                    accessibilityLabel={sendLabel}
                    icon="arrow.up"
                    variant="primary"
                    disabled={!canSend}
                    onPress={handleSend}
                  />
                )}
              </View>
            </>
          ) : null}
          {showExpandedComposer ? (
            <View>
              <ComposerToolbarRow paddingBottom={0} paddingHorizontal={0} paddingTop={8}>
                <ComposerToolbarButton
                  accessibilityLabel="Add attachment"
                  icon="plus"
                  onPress={() => void props.onPickDraftImages()}
                  showChevron={false}
                  variant="bare"
                />
                <ComposerToolbarScroller
                  fadeOpaque={toolbarFadeOpaque}
                  fadeTransparent={toolbarFadeTransparent}
                >
                  <ControlPillMenu
                    actions={modelMenuActions}
                    onPressAction={({ nativeEvent }) => handleModelMenuAction(nativeEvent.event)}
                  >
                    <ComposerToolbarTrigger
                      accessibilityLabel="Model"
                      iconNode={
                        <ProviderIcon provider={currentModelOption?.providerDriver} size={20} />
                      }
                      label={currentModelOption?.label ?? currentModelSelection.model}
                    />
                  </ControlPillMenu>
                  <ControlPillMenu
                    actions={optionsMenuActions}
                    onPressAction={({ nativeEvent }) => handleOptionsMenuAction(nativeEvent.event)}
                  >
                    <ComposerToolbarTrigger
                      accessibilityLabel="Configuration"
                      icon="slider.horizontal.3"
                      label={configurationLabel}
                    />
                  </ControlPillMenu>
                  {showStopAction ? (
                    <ComposerToolbarButton
                      accessibilityLabel="Stop"
                      icon="stop.fill"
                      variant="danger"
                      onPress={props.onStopThread}
                      showChevron={false}
                    />
                  ) : null}
                </ComposerToolbarScroller>
                <View className="shrink-0 flex-row items-center gap-1">
                  <ComposerToolbarButton
                    accessibilityLabel="Dictate with microphone"
                    icon="mic.fill"
                    onPress={() => void startDictation()}
                    showChevron={false}
                    variant="bare"
                  />
                  <ComposerToolbarButton
                    accessibilityLabel={sendLabel}
                    icon="arrow.up"
                    variant="primary"
                    disabled={!canSend}
                    onPress={handleSend}
                    showChevron={false}
                  />
                </View>
              </ComposerToolbarRow>
            </View>
          ) : null}
        </ComposerSurface>

        {/* Queue count */}
        {props.queueCount > 0 ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <Text className="pt-2 text-xs text-foreground-muted">
              {props.queueCount} queued message{props.queueCount === 1 ? "" : "s"} will send
              automatically.
            </Text>
          </Animated.View>
        ) : null}
      </View>

      <ImageViewing
        images={previewImageUri ? [{ uri: previewImageUri }] : []}
        imageIndex={0}
        visible={previewImageUri !== null}
        onRequestClose={closePreview}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
      />
    </View>
  );
});
