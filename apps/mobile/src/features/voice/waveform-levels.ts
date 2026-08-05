// Enough history to fill the widest supported composer while narrower tracks
// render only their newest visible samples.
export const WAVEFORM_POINT_COUNT = 192;
export const WAVEFORM_BAR_WIDTH = 3;
export const WAVEFORM_BAR_GAP = 3;

export function waveformPointCountForWidth(trackWidth: number): number {
  "worklet";
  const pitch = WAVEFORM_BAR_WIDTH + WAVEFORM_BAR_GAP;
  return Math.max(1, Math.floor((trackWidth + WAVEFORM_BAR_GAP) / pitch));
}

export function appendWaveformLevel(
  levels: ReadonlyArray<number>,
  level: number,
  capacity = WAVEFORM_POINT_COUNT,
): number[] {
  const bounded = Math.max(0, Math.min(1, level));
  return [...levels.slice(1 - capacity), bounded];
}

export function pcmInt16Level(buffer: ArrayBuffer): number {
  const samples = new Int16Array(buffer);
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (const sample of samples) {
    const normalized = sample / 32_768;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  return Math.min(1, rms * 4);
}
