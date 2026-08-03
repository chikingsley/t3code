# Mobile voice and active-session synchronization

Audit date: 2026-08-03. Personal fork: `chikingsley/t3code`. Working branch: `simon/mobile-voice`.

This plan is the canonical continuation of the Opus takeover audit. It covers Simon's personal mobile client, its T3 host, and the five active coding providers. Chat-history and archive-source ingestion remain owned by `chat-sync` and sit outside this plan.

## Decisions

- Preserve T3's server, contracts, client runtime, web preview, and mobile application.
- Keep the upstream remote attached to `pingdotgg/t3code` and regularly integrate upstream changes into the personal branch.
- Ship personal iOS builds through Simon's Expo and Apple accounts.
- Treat the T3 server as the single writer for T3 events, projections, provider bindings, and reconciliation watermarks.
- Support active Codex, Claude, Cursor, Grok, and OpenCode sessions.
- Keep provider-native history authoritative and preserve provider-native payloads alongside T3's normalized presentation.
- Use Peacockery Voice realtime Scribe v2 dictation with a direct visible failure state.
- Keep the existing `systemd --user` T3 service as the persistent host process.

## Current state

### Completed foundation

- Branch `simon/mobile-voice` exists from current upstream main.
- `origin` points to `chikingsley/t3code`; `upstream` points to `pingdotgg/t3code`.
- Personal Expo, EAS, bundle identifier, App Store Connect, and Apple-team configuration exists.
- Mobile web preview support exists for ordinary UI iteration.
- Realtime Peacockery Voice dictation is wired into the thread composer and new-task composer.
- T3 already uses LegendList for web and mobile timelines.
- T3 reconnects from its last event sequence and retains cached content during synchronization.

### Active gaps

1. Mobile provider icons need parity with the five active provider drivers.
1. Existing provider-native sessions need supported discovery, adoption, and incremental reconciliation.
1. Agent questions need a bounded, scrollable mobile presentation.
1. Mobile activity rendering needs complete provider lifecycle coverage and richer specialized rows.
1. Composer collapse needs a direct downward gesture.
1. Timeline opening, detached reading, turn boundaries, and terminal actions need a precise product contract.
1. Voice needs physical-device acceptance and clear failure presentation.

## 1. Provider identity

Use the correct glyph for every active driver:

| Driver   | Mobile glyph |
| -------- | ------------ |
| Codex    | OpenAI       |
| Claude   | Anthropic    |
| Cursor   | Cursor       |
| Grok     | xAI Grok     |
| OpenCode | OpenCode     |

Unknown fork-defined drivers may use the existing neutral fallback. Web and mobile should derive presentation from the driver kind rather than the selected model name.

Acceptance:

- Every provider picker and thread row renders the matching provider glyph.
- Light and dark themes retain legible contrast.
- OpenCode never renders the OpenAI glyph.

## 2. Active-session reconciliation

### Product behavior

Sessions created in T3 continue to stream directly through their provider adapter. Sessions created or continued in a provider-native client appear in T3 automatically when they belong to a registered project and active provider.

Opening, foregrounding, or reconnecting a thread may reconcile new native events while the existing timeline remains interactive. Reconciliation preserves the reader's semantic anchor. The live edge continues moving only while the reader is already following it.

### Identity

Each adopted source has one stable external identity:

```text
source machine + provider driver + native session ID
```

Each imported native event has one stable idempotency key:

```text
external session identity + native event ID or native revision
```

This permits repeated reconciliation, overlapping discovery passes, and the same cloud session appearing on multiple machines while producing one T3 wrapper and one copy of each event.

### Server command

Add a purpose-built internal reconciliation command rather than exposing the complete internal orchestration command union. The command validates:

- target T3 wrapper thread;
- provider binding and external session identity;
- ordered normalized messages and activities;
- native payloads for lossless provider-specific rendering;
- previous and next source watermarks;
- idempotency keys.

The T3 server writes imported events and advances the source watermark atomically. Clients receive ordinary typed orchestration events and require no import-specific rendering path.

### Reconciliation boundaries

Run reconciliation at:

- server startup;
- project and thread discovery;
- thread open;
- mobile or web foreground reconnect;
- native provider-store change notification;
- an explicit user refresh action.

Use filesystem/database change notification to schedule work, then reconcile from the last durable watermark. Provider-native reads remain bounded and incremental.

### Provider adapters

Each adapter exposes active-session discovery and history reconciliation through provider-specific code:

- Codex: rollout state and app-server thread history, preserving commentary and final-answer phases.
- Claude: transcript and SDK resume identity, preserving messages, tools, questions, and readable reasoning.
- Cursor: native session inventory and supported activity primitives.
- Grok: native session inventory and ACP activity primitives.
- OpenCode: SQLite/SDK session inventory and ordered text, reasoning, tool, permission, and question parts.

Capabilities declare which native primitives each adapter supplies. Shared concepts enter the normalized contract only when their semantics stay stable. Every normalized item retains its complete provider-native payload for future rendering and recovery.

### Discovery policy

Discovery covers the five active coding providers only. A discovered session qualifies for automatic adoption when:

- its provider driver is configured and healthy;
- its workspace maps to one registered T3 project;
- its native identity has no existing wrapper;
- its content includes a user-authored turn.

Ambiguous workspace mappings appear in a small review queue. A source-directory change follows provider semantics: Codex and Claude retain their native identity; OpenCode forks into the target directory on the first continuation and records the resulting identity transition.

### Validation

Focused integration tests must prove:

- initial adoption for each supported adapter;
- repeated reconciliation produces zero duplicates;
- missed external turns appear after reconciliation;
- a partially written native turn waits for a stable boundary;
- provider questions and approvals preserve their structured form;
- reconnect preserves cached content and reading position;
- an active reader detached from the tail stays anchored;
- one native session maps to one T3 wrapper across repeated discovery;
- server restart resumes from the durable watermark.

## 3. Timeline contract

### Durable event journal

The adapter records the exact provider event before broadcasting its normalized result. A client disconnect therefore affects delivery timing while the server retains enough evidence to rebuild the same visible timeline.

### Native payload retention

T3 renders common concepts such as messages, reasoning, shell commands, file changes, tools, questions, and approvals. The original provider value remains attached to the normalized item. Specialized future rendering can use information that the first projection left uninterpreted.

### Bounded first page

Opening a large thread fetches the newest useful history window rather than transferring the complete conversation. That first page includes the latest final answer anchor. Earlier pages load upward into the same virtualized list while LegendList preserves the visible item and relative offset.

### Activity grouping

User messages and final assistant prose remain primary timeline messages. Consecutive reasoning, context reads, shell commands, file changes, and tools from one provider turn become one quiet collapsed work group. Expansion reveals specialized rows and provider detail.

Pending, running, completed, interrupted, rejected, and failed states remain visible where the provider supplies them. Completion uses restrained styling; active work and failures receive stronger treatment.

### Opening and following

Support three saved opening preferences:

- `latest-answer`: position at the beginning of the latest completed assistant answer;
- `last-position`: restore a stable timeline item plus relative reading offset;
- `bottom`: open at the newest event and follow the live edge.

While a reader is detached from the tail, streaming and reconciliation preserve the current semantic anchor. A jump-to-latest control appears after the reader moves beyond the near-tail threshold. Sending a message resumes tail following only as an explicit product decision captured in the final timeline specification.

### Terminal actions

The terminal assistant message receives a compact action row that visually marks the end of the turn. Candidate actions are copy, positive feedback, negative feedback, and fork.

Current capability evidence establishes this initial mapping:

- Copy is always local.
- Feedback stays local because the five current T3 adapters expose no supported upstream rating operation.
- Codex uses app-server `thread/fork` and OpenCode uses SDK `session.fork`.
- Claude, Cursor, and Grok receive a T3 continuation fork with an explicit identity boundary until their adapters expose an equivalent native operation.

## 4. Mobile activity rendering

Render the common provider primitives with dedicated compact rows:

- reasoning;
- gathered context;
- shell command and output;
- file change and structured diff;
- generic tool call;
- MCP call;
- delegated agent task;
- question and answer;
- approval and decision;
- failure and interruption.

Keep provider-specific detail available behind disclosure. Heavy command output, patches, and raw payloads mount only after expansion.

## 5. Agent questions

Cap the question surface to a useful portion of the viewport, make its contents scrollable, render option descriptions, and support multiline custom answers. Preserve the conversation behind the question surface and its current reading position.

## 6. Composer interaction

Add a downward composer gesture that blurs the editor and dismisses the keyboard. Preserve tap-outside dismissal and iOS interactive keyboard dismissal. Keep dictated and typed text inside the same bounded, internally scrollable editor.

## 7. Voice

Use realtime Scribe v2 as the sole transcription path for this personal client. During capture, show microphone ownership, connecting, recording, processing, and failed states. A failed connection or terminal transcription displays a concise alert and retains the existing composer draft.

Physical-device acceptance must cover:

- permission granted and denied;
- connection success and failure;
- interim transcript growth;
- stop and final commit;
- composer text already present;
- thread and new-task composers;
- app backgrounding and screen navigation cleanup;
- a second microphone owner attempting capture.

## 8. Delivery and upstream maintenance

The personal mobile app uses Simon's Expo and Apple identities. Server changes reach the persistent host after the personal server build replaces the globally installed runner. Mobile JavaScript and native changes follow the appropriate development-client or EAS build path.

Before integrating upstream:

1. Preserve a clean commit boundary for personal changes.
1. Fetch `upstream`.
1. Rebase or integrate through the repository's Git workflow.
1. Run focused tests for touched contracts, server behavior, and mobile surfaces.
1. Exercise one real Codex, Claude, OpenCode, Grok, and Cursor session when the change affects provider behavior.
