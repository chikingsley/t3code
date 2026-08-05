import { describe, expect, it } from "@effect/vitest";

import { insertDictationAtSelection } from "./dictationInsertion";

describe("insertDictationAtSelection", () => {
  it("inserts the transcript at the last cursor position", () => {
    expect(
      insertDictationAtSelection({
        draft: "before after",
        selection: { start: 7, end: 7 },
        transcript: "dictated",
      }),
    ).toEqual({
      text: "before dictated after",
      selection: { start: 16, end: 16 },
    });
  });

  it("replaces the selected text and leaves the cursor after the transcript", () => {
    expect(
      insertDictationAtSelection({
        draft: "keep replace keep",
        selection: { start: 5, end: 12 },
        transcript: "dictated",
      }),
    ).toEqual({
      text: "keep dictated keep",
      selection: { start: 13, end: 13 },
    });
  });

  it("adds word-boundary spaces when dictating at the start or end", () => {
    expect(
      insertDictationAtSelection({
        draft: "existing",
        selection: { start: 0, end: 0 },
        transcript: "start",
      }),
    ).toEqual({
      text: "start existing",
      selection: { start: 6, end: 6 },
    });
    expect(
      insertDictationAtSelection({
        draft: "existing",
        selection: { start: 8, end: 8 },
        transcript: "end",
      }),
    ).toEqual({
      text: "existing end",
      selection: { start: 12, end: 12 },
    });
  });
});
