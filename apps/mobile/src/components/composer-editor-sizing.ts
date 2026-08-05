export function resolveComposerEditorSizing(input: {
  readonly contentHeight: number;
  readonly lineHeight: number;
  readonly maximumLineCount: number;
  readonly minimumLineCount: number;
  readonly verticalInset: number;
}): { readonly height: number; readonly scrollEnabled: boolean } {
  const minimumHeight = input.lineHeight * input.minimumLineCount + input.verticalInset * 2;
  const maximumHeight = input.lineHeight * input.maximumLineCount + input.verticalInset * 2;
  return {
    height: Math.max(minimumHeight, Math.min(maximumHeight, input.contentHeight)),
    scrollEnabled: input.contentHeight > maximumHeight + 0.5,
  };
}
