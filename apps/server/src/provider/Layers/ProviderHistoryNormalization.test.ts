import { expect, it } from "@effect/vitest";

import { normalizeCodexThreadHistory } from "./CodexAdapter.ts";
import { normalizeOpenCodeThreadHistory } from "./OpenCodeAdapter.ts";

it("normalizes Codex messages and tool activity with stable native ids", () => {
  const history = normalizeCodexThreadHistory({
    turns: [
      {
        id: "turn-1",
        startedAt: 1_700_000_000,
        completedAt: 1_700_000_001,
        items: [
          { id: "user-1", type: "userMessage", content: [{ type: "text", text: "ship it" }] },
          { id: "tool-1", type: "commandExecution", command: "vp test", status: "completed" },
          { id: "assistant-1", type: "agentMessage", text: "done" },
        ],
      },
    ],
  });
  expect(history.messages.map((message) => [message.role, message.text])).toEqual([
    ["user", "ship it"],
    ["assistant", "done"],
  ]);
  expect(history.activities[0]?.id).toBe("provider-history:codex:tool-1");
  expect(history.activities[0]?.kind).toBe("tool.completed");
});

it("normalizes OpenCode user and assistant parts in one provider turn", () => {
  const history = normalizeOpenCodeThreadHistory([
    {
      info: { id: "user-message", role: "user", time: { created: 1_700_000_000_000 } },
      parts: [{ id: "user-part", type: "text", text: "start" }],
    },
    {
      info: { id: "assistant-message", role: "assistant", time: { created: 1_700_000_001_000 } },
      parts: [
        { id: "reasoning-part", type: "reasoning", text: "thinking" },
        {
          id: "assistant-part",
          type: "text",
          text: "finished",
          time: { start: 1_700_000_001_000, end: 1_700_000_002_000 },
        },
      ],
    },
  ]);
  expect(history.messages.map((message) => [message.role, message.text])).toEqual([
    ["user", "start"],
    ["assistant", "finished"],
  ]);
  expect(history.messages[1]?.turnId).toBe("user-message");
  expect(history.activities[0]?.kind).toBe("task.progress");
});
