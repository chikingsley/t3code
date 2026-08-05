import { describe, expect, it } from "@effect/vitest";

import {
  appendWaveformLevel,
  pcmInt16Level,
  WAVEFORM_POINT_COUNT,
  waveformPointCountForWidth,
} from "./waveform-levels";

describe("voice waveform levels", () => {
  it("keeps the newest bounded samples", () => {
    expect(appendWaveformLevel([0.1, 0.2, 0.3], 2, 3)).toEqual([0.2, 0.3, 1]);
  });

  it("derives a normalized level from signed PCM", () => {
    const samples = new Int16Array([0, 8192, -8192, 0]);
    expect(pcmInt16Level(samples.buffer)).toBeCloseTo(Math.SQRT1_2, 2);
    expect(pcmInt16Level(new ArrayBuffer(0))).toBe(0);
  });

  it("sizes the visible history to the measured track", () => {
    expect(waveformPointCountForWidth(201)).toBe(34);
    expect(waveformPointCountForWidth(755)).toBe(126);
    expect(WAVEFORM_POINT_COUNT).toBeGreaterThanOrEqual(waveformPointCountForWidth(1_024));
  });
});
