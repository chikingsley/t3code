import { expect, it } from "@effect/vitest";

import { prioritizeHistoryBindings } from "./ProviderRuntimeIngestion.ts";

it("prioritizes newly updated provider history", () => {
  const bindings = prioritizeHistoryBindings([
    {
      threadId: "synced",
      nativeUpdatedAt: "2026-08-05T02:00:00.000Z",
      historySyncedAt: "2026-08-05T02:00:00.000Z",
    },
    {
      threadId: "older-pending",
      nativeUpdatedAt: "2026-08-05T02:30:00.000Z",
      historySyncedAt: "2026-08-05T02:00:00.000Z",
    },
    {
      threadId: "latest-pending",
      nativeUpdatedAt: "2026-08-05T02:45:00.000Z",
      historySyncedAt: "2026-08-05T02:30:00.000Z",
    },
  ]);

  expect(bindings.map((binding) => binding.threadId)).toEqual([
    "latest-pending",
    "older-pending",
    "synced",
  ]);
});
