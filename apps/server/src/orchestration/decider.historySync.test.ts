import {
  CommandId,
  MessageId,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  TurnId,
  type OrchestrationMessage,
  type OrchestrationReadModel,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { decideOrchestrationCommand } from "./decider.ts";

const NOW = "2026-08-03T12:00:00.000Z";
const threadId = ThreadId.make("history-thread");
const turnId = TurnId.make("native-turn-1");

function readModel(
  messages: OrchestrationReadModel["threads"][number]["messages"],
): OrchestrationReadModel {
  return {
    snapshotSequence: 0,
    projects: [],
    threads: [
      {
        id: threadId,
        projectId: ProjectId.make("project-1"),
        title: "History",
        modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.6" },
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        latestTurn: null,
        createdAt: NOW,
        updatedAt: NOW,
        archivedAt: null,
        settledOverride: null,
        settledAt: null,
        deletedAt: null,
        messages,
        proposedPlans: [],
        activities: [],
        checkpoints: [],
        session: null,
      },
    ],
    updatedAt: NOW,
  };
}

const historicalMessages: ReadonlyArray<OrchestrationMessage> = [
  {
    id: MessageId.make("provider-history:codex:user-1"),
    role: "user" as const,
    text: "hello",
    turnId: null,
    streaming: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: MessageId.make("provider-history:codex:assistant-1"),
    role: "assistant" as const,
    text: "world",
    turnId,
    streaming: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

it.layer(NodeServices.layer)("history reconciliation decider", (it) => {
  it.effect("matches adopted text and appends only the provider suffix", () =>
    Effect.gen(function* () {
      const decided = yield* decideOrchestrationCommand({
        command: {
          type: "thread.history.reconcile",
          commandId: CommandId.make("history-sync-1"),
          threadId,
          provider: ProviderDriverKind.make("codex"),
          messages: historicalMessages,
          activities: [],
          createdAt: NOW,
        },
        readModel: readModel([
          {
            ...historicalMessages[0]!,
            id: MessageId.make("adopted-sequential-id"),
          },
        ]),
      });
      const events = Array.isArray(decided) ? decided : [decided];
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("thread.message-sent");
      if (events[0]?.type === "thread.message-sent") {
        expect(events[0].payload.messageId).toBe(historicalMessages[1]?.id);
      }
    }),
  );

  it.effect("emits an empty batch when canonical history is already projected", () =>
    Effect.gen(function* () {
      const decided = yield* decideOrchestrationCommand({
        command: {
          type: "thread.history.reconcile",
          commandId: CommandId.make("history-sync-2"),
          threadId,
          provider: ProviderDriverKind.make("codex"),
          messages: historicalMessages,
          activities: [],
          createdAt: NOW,
        },
        readModel: readModel(historicalMessages),
      });
      expect(decided).toEqual([]);
    }),
  );
});
