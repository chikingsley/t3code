import { replaceTextRange } from "@t3tools/shared/composerTrigger";

import type { ComposerEditorSelection } from "../../components/ComposerEditor";

export function insertDictationAtSelection(input: {
  readonly draft: string;
  readonly selection: ComposerEditorSelection;
  readonly transcript: string;
}): { readonly text: string; readonly selection: ComposerEditorSelection } {
  const start = Math.max(0, Math.min(input.draft.length, input.selection.start));
  const end = Math.max(start, Math.min(input.draft.length, input.selection.end));
  const before = input.draft.slice(0, start);
  const after = input.draft.slice(end);
  const leadingSpace = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const trailingSpace = after.length > 0 && !/^\s/.test(after) ? " " : "";
  const insertion = `${leadingSpace}${input.transcript.trim()}${trailingSpace}`;
  const result = replaceTextRange(input.draft, start, end, insertion);

  return {
    text: result.text,
    selection: { start: result.cursor, end: result.cursor },
  };
}
