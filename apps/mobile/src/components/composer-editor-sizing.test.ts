import { describe, expect, it } from "@effect/vitest";

import { resolveComposerEditorSizing } from "./composer-editor-sizing";

describe("composer editor sizing", () => {
  const sizing = (contentHeight: number) =>
    resolveComposerEditorSizing({
      contentHeight,
      lineHeight: 24,
      maximumLineCount: 3,
      minimumLineCount: 1,
      verticalInset: 0,
    });

  it("grows naturally through three lines", () => {
    expect(sizing(12)).toEqual({ height: 24, scrollEnabled: false });
    expect(sizing(48)).toEqual({ height: 48, scrollEnabled: false });
    expect(sizing(72)).toEqual({ height: 72, scrollEnabled: false });
  });

  it("caps after three lines and enables internal scrolling", () => {
    expect(sizing(96)).toEqual({ height: 72, scrollEnabled: true });
  });
});
