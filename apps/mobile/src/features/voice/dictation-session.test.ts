import { describe, expect, it } from "@effect/vitest";

import {
  DictationSessionCoordinator,
  isDictationBusy,
  isDictationCapturing,
} from "./dictation-session";

describe("mobile dictation session", () => {
  it("grants one microphone owner and releases only for that owner", () => {
    const coordinator = new DictationSessionCoordinator();
    const first = Symbol("first");
    const second = Symbol("second");

    expect(coordinator.claim(first)).toBe(true);
    expect(coordinator.claim(first)).toBe(true);
    expect(coordinator.claim(second)).toBe(false);
    coordinator.release(second);
    expect(coordinator.claim(second)).toBe(false);
    coordinator.release(first);
    expect(coordinator.claim(second)).toBe(true);
  });

  it("separates capture states from non-interactive work", () => {
    expect(isDictationCapturing("connecting")).toBe(true);
    expect(isDictationCapturing("recording")).toBe(true);
    expect(isDictationCapturing("processing")).toBe(false);
    expect(isDictationBusy("requesting_permission")).toBe(true);
    expect(isDictationBusy("processing")).toBe(true);
    expect(isDictationBusy("failed")).toBe(false);
  });
});
