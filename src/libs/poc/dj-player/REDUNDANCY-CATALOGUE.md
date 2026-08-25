# REDUNDANCY-CATALOGUE

Machinery added in `-0.4` to manage the cartridge's SID-data queue and survive the buffer's retime flush, surveyed against the `host-scheduled` timing path introduced in P01-T02 (`-0.5`).

The two timing modes are:

- **cartridge-timed** (today's default): cartridge paces delivery via its own frame timer, fed by recipe packets. The recipe flushes the queue on receipt, so anything sitting in the buffer needs to be prepared before the flush reaches it.
- **host-scheduled** (P01-T02): host paces delivery entirely; recipe never sent. Cartridge's timer stays off and runs pass-through. No queue to prepare, no flush to survive.

## The Catalogue

| Machinery | What It Does | Why `-0.4` Needed It | Verdict |
|-----------|-------------|---------------------|---------|
| **Pending-step queue** (`pending: PendingStep[]`, managed by `queueResync()` and `beginRetune()`) | Ensures SID-data and control packets ride tick boundaries rather than arriving between ticks. The cartridge counts every packet as a frame and drains exactly one per timer tick, so injection between ticks causes frame-count misalignment. | Resync and retune packets needed a way to stay in step with the tick grid. This is cartridge-queue machinery by the definition that applies to every piece below. | **Still needed on both paths** — both timing modes need to respect the cartridge's frame-per-tick promise; this is a schedule constraint, not a retime-flush survival mechanism. |
| **Gate-off-then-resync sequence** (`beginRetune()` queues `RETUNE_GATE_LEAD_FRAMES` gated frames + resync; see `withVoiceGatesOff()`) | Before a speed change in cartridge-timed mode, gates all three voices off for 16 frames (roughly 320 ms at 50 Hz) to silence the buffer's contents, then sends a full register resync to restore sound once the recipe's queue flush is complete. | The cartridge's buffer holds old-rate packets when a recipe arrives. The recipe flushes the queue, leaving the chip holding whatever partial note the old rate had queued. The gate-off lead prepares the chip to survive that flush silently. | **Needed only by the buffered fallback** — host-scheduled never sends recipes, so it has no flush to prepare for. |
| **Debounced recipe resend and timer** (`recipeResendTimer`, `RECIPE_RESEND_DEBOUNCE_MS = 250ms`, managed by `scheduleRetune()` and `clearRecipeResend()`) | Collapses rapid speed changes into a single recipe send by deferring `beginRetune()` for 250 ms from the last fader movement. | Recipe packets cost the cartridge four blocking queue drains plus four diagnostic screen prints each. A fader sweep at 150 ms stacks recipes faster than the cartridge clears them. | **Needed only by the buffered fallback** — host-scheduled mode never sends recipes, so there is nothing to debounce. |
| **Deliberate three-voice silence** (`buildVoiceGateOffSnapshot()` and `withVoiceGatesOff()` forcing SID control registers $D404/$D40B/$D412 to 0) | Emits a register snapshot with all three voice gates forced to 0, silencing the chip without affecting the emulated tune state. Used in the gate-off lead of a cartridge-timed retune. | The gate-off-then-resync sequence needs a way to silence old-rate notes on the cartridge while the tune keeps playing through the buffer flush. | **Needed only by the buffered fallback** — the three-voice silence is part of the gate-off lead, which cartridge-timed needs and host-scheduled does not. |

## Explicit Exclusion

The scrub worker in `src/lib/replay/` is **not** catalogued here. It moves silent jumps off the main thread to avoid blocking during replay of the tune forward to a target frame. This is independent of the cartridge buffer and the retime flush — a concern about main-thread stall that stays useful on both paths. It is left in place.

## Removal Gate

Nothing is removed by this iteration. The buffered (cartridge-timed) path remains selectable and all the machinery it requires stays in the codebase. This catalogue exists so that a later cleanup — either deleting these pieces if the measurement settles on host-scheduled, or refactoring them if both paths stay — is a deliberate decision rather than archaeology.
