import { describe, expect, it } from "vite-plus/test";

import { normalizeCodexNativeSession } from "./CodexAdapter.ts";
import { normalizeOpenCodeNativeSession } from "./OpenCodeAdapter.ts";

describe("provider native session catalogs", () => {
  it("normalizes Codex identity, timestamps, and archive state", () => {
    const session = normalizeCodexNativeSession(
      {
        cliVersion: "1.0.0",
        createdAt: 1_767_225_600,
        cwd: "/work/codex-project",
        ephemeral: false,
        id: "codex-native-1",
        modelProvider: "openai",
        name: "Catalog thread",
        preview: "First prompt",
        sessionId: "codex-native-1",
        source: "vscode",
        status: { type: "notLoaded" },
        turns: [],
        updatedAt: 1_767_225_660,
      },
      true,
    );

    expect(session).toMatchObject({
      nativeId: "codex-native-1",
      title: "Catalog thread",
      cwd: "/work/codex-project",
      archived: true,
      resumeCursor: { threadId: "codex-native-1" },
    });
    expect(session.updatedAt).toBe("2026-01-01T00:01:00.000Z");
  });

  it("normalizes root OpenCode identity, model, and archive state", () => {
    const session = normalizeOpenCodeNativeSession({
      id: "ses_native_1",
      slug: "native-1",
      projectID: "project-1",
      directory: "/work/opencode-project",
      title: "OpenCode catalog thread",
      model: { providerID: "opencode-go", id: "deepseek-v4-flash" },
      version: "1.2.3",
      time: {
        created: 1_767_225_600_000,
        updated: 1_767_225_660_000,
        archived: 1_767_225_700_000,
      },
      project: null,
    });

    expect(session).toEqual({
      nativeId: "ses_native_1",
      title: "OpenCode catalog thread",
      cwd: "/work/opencode-project",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:01:00.000Z",
      archived: true,
      resumeCursor: { schemaVersion: 1, sessionId: "ses_native_1" },
      model: "opencode-go/deepseek-v4-flash",
    });
  });
});
