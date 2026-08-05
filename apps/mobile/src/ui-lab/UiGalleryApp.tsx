import {
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconChevronUp as ChevronUp,
  IconCopy as Copy,
  IconGitFork as GitFork,
  IconThumbDown as ThumbsDown,
  IconThumbUp as ThumbsUp,
} from "@tabler/icons-react-native";
import * as Clipboard from "expo-clipboard";
import { useFonts } from "expo-font";
import { useEffect, useState, type ReactNode } from "react";
import * as Schema from "effect/Schema";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Uniwind } from "uniwind";

import {
  ApprovalRequestId,
  EnvironmentId,
  EventId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  TurnId,
  type OrchestrationThread,
  type OrchestrationThreadActivity,
  type OrchestrationThreadShell,
  ServerProviders,
  type ServerProvider,
} from "@t3tools/contracts";

import { ProviderGlyph, type ProviderGlyphName } from "./ProviderGlyph";
import { AppText as Text } from "../components/AppText";
import { OverlayPortalHost } from "../components/OverlayPortal";
import { PendingUserInputCard } from "../features/threads/PendingUserInputCard";
import { ThreadComposer } from "../features/threads/ThreadComposer";
import {
  buildPendingUserInputAnswers,
  buildThreadFeed,
  type PendingUserInput,
  type PendingUserInputDraftAnswer,
  type ThreadFeedActivity,
} from "../lib/threadActivity";

interface Palette {
  readonly background: string;
  readonly border: string;
  readonly control: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly text: string;
  readonly textMuted: string;
  readonly user: string;
}

const light: Palette = {
  background: "#FFFFFF",
  border: "#E4E4E7",
  control: "#F1F1F2",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F5F5",
  text: "#18181B",
  textMuted: "#71717A",
  user: "#F1F1F2",
};

const dark: Palette = {
  background: "#09090B",
  border: "#27272A",
  control: "#27272A",
  surface: "#111113",
  surfaceMuted: "#1C1C1F",
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  user: "#27272A",
};

const typeRoles = [
  ["Screen title", "24 / 30 · Bold", 24, 30, "700"],
  ["Section title", "18 / 24 · Semibold", 18, 24, "600"],
  ["Readable body copy", "16 / 24 · Regular", 16, 24, "400"],
  ["Compact row preview", "15 / 20 · Regular", 15, 20, "400"],
  ["Field and section label", "14 / 20 · Medium", 14, 20, "500"],
  ["Control label", "14 / 20 · Semibold", 14, 20, "600"],
  ["5:24 PM · 1:23", "13 / 18 · Regular", 13, 18, "400"],
  ["Processing status", "12 / 16 · Medium", 12, 16, "500"],
] as const;

function Section({
  children,
  description,
  palette,
  title,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly palette: Palette;
  readonly title: string;
}) {
  return (
    <View style={[styles.section, { borderColor: palette.border }]}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.meta, { color: palette.textMuted }]}>{description}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ProviderCard({
  glyph,
  label,
  palette,
}: {
  readonly glyph: ProviderGlyphName;
  readonly label: string;
  readonly palette: Palette;
}) {
  return (
    <View style={styles.providerItem}>
      <View style={[styles.iconTarget, { backgroundColor: palette.control }]}>
        <ProviderGlyph color={palette.text} name={glyph} size={22} />
      </View>
      <Text style={[styles.status, { color: palette.textMuted }]}>{label}</Text>
    </View>
  );
}

function makeGalleryActivity(
  input: Pick<OrchestrationThreadActivity, "id" | "kind" | "summary" | "createdAt"> &
    Partial<OrchestrationThreadActivity>,
): OrchestrationThreadActivity {
  return { tone: "tool", payload: {}, turnId: TurnId.make("ui-lab-turn"), ...input };
}

const galleryActivities = [
  makeGalleryActivity({
    id: EventId.make("ui-lab-file-read"),
    kind: "tool.completed",
    summary: "Read 4 files",
    createdAt: "2026-08-04T12:00:01.000Z",
    payload: {
      title: "Read 4 files",
      itemType: "file_read",
      status: "completed",
      detail: [
        "apps/mobile/src/features/threads/ThreadComposer.tsx",
        "apps/mobile/src/features/threads/ThreadFeed.tsx",
        "apps/mobile/src/lib/threadActivity.ts",
        "packages/contracts/src/orchestration.ts",
      ].join("\n"),
    },
  }),
  makeGalleryActivity({
    id: EventId.make("ui-lab-command"),
    kind: "tool.completed",
    summary: "Run focused tests",
    createdAt: "2026-08-04T12:00:02.000Z",
    payload: {
      title: "Run focused tests",
      itemType: "command_execution",
      status: "completed",
      detail: "vp test run apps/mobile/src/lib/threadActivity.test.ts\nexit 0",
      data: { item: { command: "vp test run apps/mobile/src/lib/threadActivity.test.ts" } },
    },
  }),
  makeGalleryActivity({
    id: EventId.make("ui-lab-file-change"),
    kind: "tool.completed",
    summary: "Edit the mobile composer",
    createdAt: "2026-08-04T12:00:03.000Z",
    payload: {
      title: "Edit the mobile composer",
      itemType: "file_change",
      status: "completed",
      data: { item: { path: "apps/mobile/src/features/threads/ThreadComposer.tsx" } },
    },
  }),
] as const;

const galleryThread: OrchestrationThread = {
  id: ThreadId.make("ui-lab-thread"),
  projectId: ProjectId.make("ui-lab-project"),
  title: "UI lab activity fixtures",
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.6-sol" },
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: null,
  worktreePath: null,
  latestTurn: null,
  createdAt: "2026-08-04T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:03.000Z",
  archivedAt: null,
  deletedAt: null,
  settledOverride: null,
  settledAt: null,
  messages: [],
  proposedPlans: [],
  activities: galleryActivities,
  checkpoints: [],
  session: null,
};

const galleryFeedActivities = buildThreadFeed(galleryThread).flatMap((entry) =>
  entry.type === "activity-group" ? entry.activities : [],
);

function ActivityRow({
  activity,
  palette,
}: {
  readonly activity: ThreadFeedActivity;
  readonly palette: Palette;
}) {
  const [open, setOpen] = useState(false);
  const fullDetail = open ? activity.getFullDetail() : null;
  return (
    <View>
      <Pressable
        accessibilityLabel={`${open ? "Hide" : "Show"} ${activity.summary}`}
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={styles.activityItem}
        testID={`ui-lab-activity-${activity.id}`}
      >
        <View style={styles.activityCopy}>
          <Text style={[styles.label, { color: palette.text }]}>{activity.summary}</Text>
          <Text numberOfLines={1} style={[styles.meta, { color: palette.textMuted }]}>
            {activity.detail}
          </Text>
        </View>
        {activity.canExpand ? (
          open ? (
            <ChevronUp color={palette.textMuted} size={18} />
          ) : (
            <ChevronDown color={palette.textMuted} size={18} />
          )
        ) : null}
      </Pressable>
      {fullDetail ? (
        <View style={[styles.commandPanel, { backgroundColor: palette.surfaceMuted }]}>
          <Text style={[styles.code, { color: palette.text }]}>{fullDetail}</Text>
        </View>
      ) : null}
    </View>
  );
}

function WorkLog({ palette }: { readonly palette: Palette }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityLabel={`${open ? "Hide" : "Show"} work log`}
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={styles.workLogTrigger}
        testID="ui-lab-work-log-toggle"
      >
        <View style={styles.activityCopy}>
          <Text style={[styles.label, { color: palette.text }]}>Worked for 1.2s</Text>
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            4 files read, 1 command run, 1 file edited
          </Text>
        </View>
        {open ? (
          <ChevronUp color={palette.textMuted} size={18} />
        ) : (
          <ChevronDown color={palette.textMuted} size={18} />
        )}
      </Pressable>
      {open ? (
        <View style={[styles.activitySequence, { borderColor: palette.border }]}>
          {galleryFeedActivities.map((activity) => (
            <ActivityRow activity={activity} key={activity.id} palette={palette} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TurnActions({ palette }: { readonly palette: Palette }) {
  const [status, setStatus] = useState("End of turn");
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const copyTurn = async () => {
    await Clipboard.setStringAsync(
      "Final prose stays primary, and the action rail marks the end of the turn.",
    );
    setStatus("Answer copied");
  };
  return (
    <View style={styles.turnActionGroup}>
      <View style={styles.turnActions}>
        <Pressable
          accessibilityLabel="Copy answer"
          accessibilityRole="button"
          onPress={copyTurn}
          style={styles.actionTarget}
        >
          <Copy color={palette.textMuted} size={17} />
        </Pressable>
        <Pressable
          accessibilityLabel="Helpful answer"
          accessibilityRole="button"
          accessibilityState={{ selected: feedback === "up" }}
          onPress={() => {
            setFeedback("up");
            setStatus("Helpful feedback selected");
          }}
          style={[styles.actionTarget, feedback === "up" && { backgroundColor: palette.control }]}
        >
          <ThumbsUp color={palette.textMuted} size={17} />
        </Pressable>
        <Pressable
          accessibilityLabel="Unhelpful answer"
          accessibilityRole="button"
          accessibilityState={{ selected: feedback === "down" }}
          onPress={() => {
            setFeedback("down");
            setStatus("Unhelpful feedback selected");
          }}
          style={[styles.actionTarget, feedback === "down" && { backgroundColor: palette.control }]}
        >
          <ThumbsDown color={palette.textMuted} size={17} />
        </Pressable>
        <Pressable
          accessibilityLabel="Fork from this turn"
          accessibilityRole="button"
          onPress={() => setStatus("Fork action selected")}
          style={styles.actionTarget}
        >
          <GitFork color={palette.textMuted} size={17} />
        </Pressable>
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.status, { color: palette.textMuted }]}>
        {status}
      </Text>
    </View>
  );
}

const galleryEnvironmentId = EnvironmentId.make("ui-lab-environment");
const decodeUiLabProviders = Schema.decodeUnknownPromise(ServerProviders);

const galleryThreadShell: OrchestrationThreadShell = {
  id: galleryThread.id,
  projectId: galleryThread.projectId,
  title: galleryThread.title,
  modelSelection: galleryThread.modelSelection,
  runtimeMode: galleryThread.runtimeMode,
  interactionMode: galleryThread.interactionMode,
  branch: galleryThread.branch,
  worktreePath: galleryThread.worktreePath,
  latestTurn: galleryThread.latestTurn,
  createdAt: galleryThread.createdAt,
  updatedAt: galleryThread.updatedAt,
  archivedAt: galleryThread.archivedAt,
  settledOverride: galleryThread.settledOverride,
  settledAt: galleryThread.settledAt,
  session: galleryThread.session,
  latestUserMessageAt: null,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  hasActionableProposedPlan: false,
};

function GalleryProductionComposer(props: {
  readonly colorScheme: "light" | "dark";
  readonly draft: string;
  readonly onChangeDraft: (value: string) => void;
  readonly onNotice: (value: string) => void;
}) {
  const [modelSelection, setModelSelection] = useState(galleryThreadShell.modelSelection);
  const [runtimeMode, setRuntimeMode] = useState(galleryThreadShell.runtimeMode);
  const [interactionMode, setInteractionMode] = useState(galleryThreadShell.interactionMode);
  const [providers, setProviders] = useState<ReadonlyArray<ServerProvider>>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/_ui-lab/providers", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Provider snapshot request failed: ${response.status}`);
        return response.json();
      })
      .then(decodeUiLabProviders)
      .then(setProviders)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        props.onNotice("Provider snapshot unavailable");
      });
    return () => controller.abort();
  }, [props.onNotice]);

  return (
    <ThreadComposer
      activeThreadBusy={false}
      colorScheme={props.colorScheme}
      connectionError={null}
      connectionState="connected"
      contentMaxWidth={960}
      draftAttachments={[]}
      draftMessage={props.draft}
      environmentId={galleryEnvironmentId}
      environmentLabel="gmk"
      onChangeDraftMessage={props.onChangeDraft}
      onNativePasteImages={async () => props.onNotice("Pasted image fixture received")}
      onPickDraftImages={async () => props.onNotice("Attachment action selected")}
      onReconnectEnvironment={() => props.onNotice("Reconnect action selected")}
      onRemoveDraftImage={() => undefined}
      onSendMessage={async () => {
        props.onChangeDraft("");
        props.onNotice("Message sent");
        return null;
      }}
      onStopThread={() => props.onNotice("Stop action selected")}
      onUpdateInteractionMode={(value) => {
        setInteractionMode(value);
        props.onNotice(`Interaction set to ${value}`);
      }}
      onUpdateModelSelection={(value) => {
        setModelSelection(value);
        props.onNotice("Model configuration updated");
      }}
      onUpdateRuntimeMode={(value) => {
        setRuntimeMode(value);
        props.onNotice(`Runtime set to ${value}`);
      }}
      placeholder="Ask anything"
      projectCwd="/home/simon/github/t3code"
      queueCount={0}
      selectedThread={{
        ...galleryThreadShell,
        interactionMode,
        modelSelection,
        runtimeMode,
      }}
      serverConfig={{ providers }}
    />
  );
}

function ComposerDemo(props: {
  readonly appearance: "light" | "dark";
  readonly onChangeAppearance: (appearance: "light" | "dark") => void;
  readonly palette: Palette;
}) {
  const [draft, setDraft] = useState(
    "Compare the full interaction contract with the Codex reference.",
  );
  const [notice, setNotice] = useState("Ready");

  return (
    <View style={styles.composerDemo}>
      <View style={styles.composerDemoHeader}>
        <Text style={[styles.label, { color: props.palette.text }]}>Appearance</Text>
        <View style={[styles.segmented, { backgroundColor: props.palette.surfaceMuted }]}>
          {(["light", "dark"] as const).map((value) => (
            <Pressable
              accessibilityRole="button"
              key={value}
              onPress={() => props.onChangeAppearance(value)}
              style={[
                styles.segment,
                props.appearance === value && { backgroundColor: props.palette.surface },
              ]}
            >
              <Text style={[styles.status, { color: props.palette.text }]}>{value}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <GalleryProductionComposer
        colorScheme={props.appearance}
        draft={draft}
        onChangeDraft={setDraft}
        onNotice={setNotice}
      />
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.meta, styles.composerNotice, { color: props.palette.textMuted }]}
      >
        {notice}
      </Text>
    </View>
  );
}

const galleryPendingUserInput: PendingUserInput = {
  requestId: ApprovalRequestId.make("ui-lab-question"),
  createdAt: "2026-08-04T12:00:04.000Z",
  questions: [
    {
      id: "composer-behavior",
      header: "Composer behavior",
      question: "What should happen while you inspect an active turn?",
      options: [
        {
          label: "Keep it visible",
          description: "The composer stays available above the keyboard.",
        },
        {
          label: "Collapse to one line",
          description: "The timeline receives the maximum reading area.",
        },
      ],
      multiSelect: false,
    },
    {
      id: "visible-context",
      header: "Visible context",
      question: "Which context belongs in an expanded work log?",
      options: [
        { label: "Commands", description: "Show commands supplied by provider activities." },
        { label: "Files", description: "Show file paths supplied by provider activities." },
        { label: "Output", description: "Show output supplied by provider activities." },
      ],
      multiSelect: true,
    },
  ],
};

function QuestionDemo({ palette }: { readonly palette: Palette }) {
  const [drafts, setDrafts] = useState<Record<string, PendingUserInputDraftAnswer>>({});
  const [status, setStatus] = useState<"active" | "declined" | "submitted">("active");
  const answers = buildPendingUserInputAnswers(galleryPendingUserInput.questions, drafts);

  if (status !== "active") {
    return (
      <View style={[styles.questionResult, { backgroundColor: palette.surfaceMuted }]}>
        <Check color={palette.textMuted} size={18} />
        <Text style={[styles.body, styles.flex, { color: palette.text }]}>
          {status === "declined" ? "Question request declined" : "Answers submitted"}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setStatus("active")}
          style={[styles.toastAction, { backgroundColor: palette.control }]}
        >
          <Text style={[styles.buttonText, { color: palette.text }]}>Restore</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <PendingUserInputCard
      answers={answers}
      drafts={drafts}
      onChangeCustomAnswer={async (_requestId, questionId, customAnswer) => {
        setDrafts((current) => ({ ...current, [questionId]: { customAnswer } }));
      }}
      onReject={async () => setStatus("declined")}
      onSelectOption={async (_requestId, questionId, label) => {
        const question = galleryPendingUserInput.questions.find((entry) => entry.id === questionId);
        setDrafts((current) => {
          const selected = current[questionId]?.selectedOptionLabels ?? [];
          const selectedOptionLabels = question?.multiSelect
            ? selected.includes(label)
              ? selected.filter((candidate) => candidate !== label)
              : [...selected, label]
            : [label];
          return { ...current, [questionId]: { selectedOptionLabels } };
        });
      }}
      onSubmit={async () => setStatus("submitted")}
      pendingUserInput={galleryPendingUserInput}
      respondingUserInputId={null}
    />
  );
}

function Gallery() {
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const [appearance, setAppearance] = useState<"light" | "dark">(
    systemScheme === "dark" ? "dark" : "light",
  );
  const palette = appearance === "dark" ? dark : light;
  const horizontalPadding = width < 520 ? 16 : 24;
  const selectAppearance = (value: "light" | "dark") => {
    Uniwind.setTheme(value);
    setAppearance(value);
  };

  useEffect(() => () => Uniwind.setTheme("system"), []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: palette.background }}
      >
        <View style={[styles.header, width < 560 && styles.headerNarrow]}>
          <View style={styles.flex}>
            <Text style={[styles.screenTitle, { color: palette.text }]}>T3 Mobile UI Lab</Text>
            <Text style={[styles.meta, { color: palette.textMuted }]}>
              Functional acceptance surface · real interactions · responsive geometry
            </Text>
          </View>
          <View style={[styles.segmented, { backgroundColor: palette.control }]}>
            {(["light", "dark"] as const).map((value) => (
              <Pressable
                accessibilityRole="button"
                key={value}
                onPress={() => selectAppearance(value)}
                style={[
                  styles.segment,
                  appearance === value && { backgroundColor: palette.surface },
                ]}
              >
                <Text style={[styles.status, { color: palette.text }]}>{value}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Section
          description="Daily Report system typography, four-point spacing, and shared control geometry."
          palette={palette}
          title="Foundations"
        >
          <View style={styles.foundationGrid}>
            {typeRoles.map(([sample, label, fontSize, lineHeight, fontWeight]) => (
              <View key={sample} style={styles.foundationRole}>
                <Text style={{ color: palette.text, fontSize, fontWeight, lineHeight }}>
                  {sample}
                </Text>
                <Text style={[styles.status, { color: palette.textMuted }]}>{label}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section
          description="One Nano Icons provider asset across web, iOS, and Android."
          palette={palette}
          title="Provider identity"
        >
          <View style={styles.providerRow}>
            <ProviderCard glyph="openai" label="Codex" palette={palette} />
            <ProviderCard glyph="opencode" label="OpenCode" palette={palette} />
            <ProviderCard glyph="anthropic" label="Claude" palette={palette} />
            <ProviderCard glyph="xai" label="Grok" palette={palette} />
          </View>
        </Section>

        <Section
          description="Collapsed work stays quiet. Expansion reveals real context, command, output, and file-change detail."
          palette={palette}
          title="Chat timeline"
        >
          <View style={styles.stack}>
            <View style={[styles.userBubble, { backgroundColor: palette.user }]}>
              <Text style={[styles.body, { color: palette.text }]}>
                Show me exactly what the agent did.
              </Text>
            </View>
            <View style={styles.assistantTurn}>
              <Text style={[styles.body, { color: palette.text }]}>
                The work log below is a real disclosure. Open it to inspect every activity.
              </Text>
              <WorkLog palette={palette} />
              <Text style={[styles.body, { color: palette.text }]}>
                Final prose stays primary, and the action rail marks the end of the turn.
              </Text>
              <TurnActions palette={palette} />
            </View>
          </View>
        </Section>

        <Section
          description="The production composer: type, choose controls, dictate, and send."
          palette={palette}
          title="Composer and voice"
        >
          <ComposerDemo
            appearance={appearance}
            onChangeAppearance={selectAppearance}
            palette={palette}
          />
        </Section>

        <Section
          description="One question per page with complete back, continue, submit, custom-answer, and decline behavior."
          palette={palette}
          title="Agent question"
        >
          <QuestionDemo palette={palette} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function UiGalleryApp() {
  const [providerFontLoaded, providerFontError] = useFonts({
    VibePadProviders: require("./assets/VibePadProviders.ttf"),
  });
  if (!(providerFontLoaded || providerFontError)) return null;
  return (
    <SafeAreaProvider>
      <View style={styles.appRoot}>
        <Gallery />
        <OverlayPortalHost />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  activityCopy: { flex: 1, gap: 2, minWidth: 0 },
  activityItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activitySequence: { borderLeftWidth: 1, gap: 4, marginLeft: 10, paddingLeft: 8 },
  assistantTurn: { gap: 14, maxWidth: 760 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  buttonText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  code: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  commandPanel: { borderRadius: 8, gap: 4, marginHorizontal: 10, marginBottom: 8, padding: 10 },
  composerDemo: { gap: 14 },
  composerDemoHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  composerNotice: { minHeight: 18, paddingHorizontal: 20 },
  content: {
    alignSelf: "center",
    gap: 28,
    maxWidth: 960,
    paddingBottom: 96,
    paddingTop: 24,
    width: "100%",
  },
  flex: { flex: 1 },
  foundationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  foundationRole: { minWidth: 220, width: "47%" },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  headerNarrow: { flexDirection: "column" },
  iconTarget: {
    alignItems: "center",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  label: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  meta: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  providerItem: { alignItems: "center", gap: 6, width: 64 },
  providerRow: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  questionResult: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  safe: { flex: 1 },
  screenTitle: { fontSize: 24, fontWeight: "700", lineHeight: 30 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, gap: 4, paddingTop: 22 },
  sectionBody: { marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "600", lineHeight: 24 },
  segment: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  segmented: { borderRadius: 12, flexDirection: "row", padding: 3 },
  stack: { gap: 16 },
  status: { fontSize: 12, fontWeight: "500", lineHeight: 16 },
  toastAction: { borderRadius: 10, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 },
  actionTarget: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  turnActionGroup: { alignItems: "flex-start", gap: 2 },
  turnActions: { flexDirection: "row", gap: 2 },
  userBubble: {
    alignSelf: "flex-end",
    borderRadius: 16,
    maxWidth: "86%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  workLogTrigger: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
    paddingVertical: 6,
  },
});
