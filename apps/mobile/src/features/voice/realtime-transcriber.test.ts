import { describe, expect, it } from "@effect/vitest";

import { parseRealtimeEvent } from "./realtime-transcriber";

const event = (value: Record<string, unknown>) =>
  JSON.stringify({
    protocol_version: 1,
    sequence: 1,
    session_id: "session-1",
    ...value,
  });

describe("Peacockery Voice realtime protocol", () => {
  it("accepts current transcript events", () => {
    expect(parseRealtimeEvent(event({ text: "hello", type: "transcript.interim" }))).toMatchObject({
      sequence: 1,
      text: "hello",
      type: "transcript.interim",
    });
  });

  it("reads the terminal artifact text from the generated contract", () => {
    expect(
      parseRealtimeEvent(
        event({ result: { text: "finished" }, status: "succeeded", type: "session.completed" }),
      ),
    ).toMatchObject({ result: { text: "finished" }, type: "session.completed" });
  });

  it("rejects malformed and unsupported protocol events", () => {
    expect(parseRealtimeEvent("not-json")).toBeNull();
    expect(
      parseRealtimeEvent(
        JSON.stringify({
          protocol_version: 2,
          sequence: 1,
          session_id: "session-1",
          type: "session.started",
        }),
      ),
    ).toBeNull();
    expect(parseRealtimeEvent(event({ type: "transcript.interim" }))).toBeNull();
  });
});
