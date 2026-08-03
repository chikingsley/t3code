export type DictationPhase =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "recording"
  | "processing"
  | "failed";

export class DictationSessionCoordinator {
  private owner: symbol | null = null;

  claim(owner: symbol): boolean {
    if (this.owner) {
      return this.owner === owner;
    }
    this.owner = owner;
    return true;
  }

  release(owner: symbol): void {
    if (this.owner === owner) {
      this.owner = null;
    }
  }
}

export const dictationSessionCoordinator = new DictationSessionCoordinator();

export const isDictationCapturing = (phase: DictationPhase): boolean =>
  phase === "connecting" || phase === "recording";

export const isDictationBusy = (phase: DictationPhase): boolean =>
  phase === "requesting_permission" || phase === "processing";
