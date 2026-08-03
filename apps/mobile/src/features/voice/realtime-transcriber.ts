import {
  createPeacockeryVoiceClient,
  type components,
} from "@simonpeacocks/peacockery-voice-client";

import type { VoiceConfig } from "./voice-config";

type RealtimeSessionResult = components["schemas"]["RealtimeSessionResult"];

interface TranscriptEvent {
  protocol_version: 1;
  sequence: number;
  session_id: string;
  text: string;
  type: "transcript.committed" | "transcript.delta" | "transcript.interim";
}

interface SessionStartedEvent {
  protocol_version: 1;
  sequence: number;
  session_id: string;
  type: "session.started";
}

type RealtimeEvent = TranscriptEvent | SessionStartedEvent | RealtimeSessionResult;

export interface RealtimeCallbacks {
  readonly onError?: (message: string) => void;
  readonly onOpen?: () => void;
  readonly onTranscript: (text: string, final: boolean) => void;
}

interface NativeWebSocketOptions {
  readonly headers?: Record<string, string>;
}

type NativeWebSocketConstructor = new (
  url: string,
  protocols?: string | string[],
  options?: NativeWebSocketOptions,
) => WebSocket;

export interface RealtimeStopResult {
  readonly error: string | null;
  readonly text: string | null;
}

const MAX_PENDING_BUFFERS = 100;
const STOP_TIMEOUT_MS = 4_000;

const wsBaseUrl = (baseUrl: string): string =>
  baseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");

export class RealtimeTranscriber {
  private ws: WebSocket | null = null;
  private opened = false;
  private closed = false;
  private readonly pending: ArrayBuffer[] = [];
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  private completedTranscript: string | null = null;
  private failureMessage: string | null = null;
  private deltaText = "";
  private sessionId: string | null = null;
  private lastSequence = -1;

  constructor(
    private readonly callbacks: RealtimeCallbacks,
    private readonly config: VoiceConfig,
  ) {}

  feed(pcm: ArrayBuffer, sampleRate: number): void {
    if (this.closed) {
      return;
    }
    if (this.ws) {
      if (this.opened) {
        this.ws.send(pcm);
      } else {
        this.queuePending(pcm);
      }
      return;
    }
    this.open(Math.round(sampleRate));
    this.queuePending(pcm);
  }

  cancel(): void {
    this.closed = true;
    const socket = this.ws;
    this.cleanup();
    if (
      socket &&
      (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
    ) {
      socket.close(1000, "Dictation cancelled");
    }
  }

  async stop(): Promise<RealtimeStopResult> {
    const socket = this.ws;
    if (this.closed || !socket) {
      this.cleanup();
      return { error: this.failureMessage, text: this.completedTranscript };
    }
    this.closed = true;
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) {
          return;
        }
        settled = true;
        this.cleanup();
        resolve();
      };
      const timer = setTimeout(() => {
        try {
          socket.close();
        } catch {
          // The native socket can close between the ready-state check and timeout.
        }
        done();
      }, STOP_TIMEOUT_MS);
      socket.addEventListener("close", () => {
        clearTimeout(timer);
        done();
      });
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "close" }));
      } else if (socket.readyState !== WebSocket.CONNECTING) {
        clearTimeout(timer);
        done();
      }
    });

    if (!this.completedTranscript && this.sessionId) {
      await this.recoverTerminalResult();
    }
    return { error: this.failureMessage, text: this.completedTranscript };
  }

  private queuePending(pcm: ArrayBuffer): void {
    this.pending.push(pcm);
    if (this.pending.length > MAX_PENDING_BUFFERS) {
      this.pending.shift();
    }
  }

  private open(sampleRate: number): void {
    const params = new URLSearchParams({
      channels: "1",
      encoding: "pcm_s16le",
      interim_results: "true",
      model: this.config.model,
      punctuate: "true",
      sample_rate: String(sampleRate),
      smart_format: "true",
    });
    const url = `${wsBaseUrl(this.config.baseUrl)}/v1/realtime?${params.toString()}`;
    const NativeWebSocket = WebSocket as unknown as NativeWebSocketConstructor;
    const socket = new NativeWebSocket(url, [], {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    });
    socket.binaryType = "arraybuffer";
    this.ws = socket;

    socket.addEventListener("open", () => {
      if (this.closed) {
        this.pending.length = 0;
        socket.close();
        return;
      }
      this.opened = true;
      this.callbacks.onOpen?.();
      for (const buffer of this.pending) {
        socket.send(buffer);
      }
      this.pending.length = 0;
      this.keepAlive = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 5_000);
    });

    socket.addEventListener("message", (event) => {
      const message = parseRealtimeEvent(event.data);
      if (!message || message.sequence <= this.lastSequence) {
        return;
      }
      this.lastSequence = message.sequence;
      this.handleMessage(message);
    });

    socket.addEventListener("error", () => {
      this.fail("Voice Lab connection failed");
    });

    socket.addEventListener("close", () => {
      this.cleanup();
    });
  }

  private handleMessage(message: RealtimeEvent): void {
    if (message.type === "session.started") {
      this.sessionId = message.session_id;
      return;
    }
    if (message.type === "session.completed") {
      this.completedTranscript = message.result.text.trim();
      return;
    }
    if (message.type === "session.failed") {
      this.fail(message.error.message);
      return;
    }
    if (message.type === "transcript.delta") {
      this.deltaText += message.text;
      this.callbacks.onTranscript(this.deltaText, false);
      return;
    }
    if (message.type === "transcript.interim") {
      this.deltaText = "";
      this.callbacks.onTranscript(message.text, false);
      return;
    }
    this.deltaText = "";
    this.callbacks.onTranscript(message.text, true);
  }

  private async recoverTerminalResult(): Promise<void> {
    const client = createPeacockeryVoiceClient({
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
    });
    const { data, error, response } = await client.GET("/v1/realtime/sessions/{session_id}", {
      params: { path: { session_id: this.sessionId! } },
    });
    if (data?.type === "session.completed") {
      this.completedTranscript = data.result.text.trim();
      return;
    }
    if (data?.type === "session.failed") {
      this.fail(data.error.message);
      return;
    }
    const serviceMessage =
      error && "error" in error && typeof error.error === "string" ? error.error : null;
    this.fail(serviceMessage ?? `Voice Lab recovery failed (${response.status})`);
  }

  private fail(message: string): void {
    if (this.failureMessage) {
      return;
    }
    this.failureMessage = message;
    this.callbacks.onError?.(message);
  }

  private cleanup(): void {
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
    this.pending.length = 0;
    this.opened = false;
    this.ws = null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isProtocolEvent = (value: Record<string, unknown>): boolean =>
  value.protocol_version === 1 &&
  typeof value.sequence === "number" &&
  Number.isInteger(value.sequence) &&
  typeof value.session_id === "string";

export function parseRealtimeEvent(data: unknown): RealtimeEvent | null {
  if (typeof data !== "string") {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(data) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value) || !isProtocolEvent(value) || typeof value.type !== "string") {
    return null;
  }
  if (value.type === "session.started") {
    return value as unknown as SessionStartedEvent;
  }
  if (
    value.type === "transcript.committed" ||
    value.type === "transcript.delta" ||
    value.type === "transcript.interim"
  ) {
    return typeof value.text === "string" ? (value as unknown as TranscriptEvent) : null;
  }
  if (!isRecord(value.result) || typeof value.result.text !== "string") {
    return null;
  }
  if (value.type === "session.completed" && value.status === "succeeded") {
    return value as unknown as RealtimeSessionResult;
  }
  if (
    value.type === "session.failed" &&
    value.status === "failed" &&
    isRecord(value.error) &&
    typeof value.error.message === "string"
  ) {
    return value as unknown as RealtimeSessionResult;
  }
  return null;
}
