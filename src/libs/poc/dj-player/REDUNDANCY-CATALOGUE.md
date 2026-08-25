# What `-0.6` removed, and what survived it

`-0.5` ran two timing paths side by side so they could be compared by ear: **cartridge-timed**, which
sent a framerate recipe packet and let the cartridge's own frame timer pace the stream, and
**host-scheduled**, which sent no recipe and paced delivery from the browser against each frame's own
due time. Host-scheduled won. `-0.6` deleted the other arm and everything that existed only to serve
it, so there is now one way to pace the stream and no branch anywhere asking which mode is running.

This note replaces the survey that made that decision deliberate. The decision is made; what is worth
keeping is the record of what went, what stayed, and the one operational warning the deleted code was
carrying.

## Read this before you debug a timing problem

**A cartridge that has already been sent a recipe keeps its frame timer on.** The host cannot un-send
one and cannot read the flag back — ASID is one-way, browser to cartridge. The firmware's
`APT_ContFramerate` handler sets `FrameTimerMode = true` unconditionally on receipt, and it clears
only when the ASID player app on the C64 is exited and re-entered (`InitHndlr_ASID` sets it false), or
when the operator toggles it with `t` at the C64, or on a cartridge reset.

So a cartridge left in a timed mode by an earlier session — an older build of this app, DeepSID, or
anything else that speaks the recipe — will fight this host silently. The symptom is audible (drift,
glitching, dropouts as its buffer over- or under-runs) and the cause is not discoverable from the
browser. **Check the frame timer reads `Off` at the C64 before blaming the host.**

## Removed

- The `cartridge-timed` arm in full: the `TimingMode` and `SpeedMode` types and their signals,
  setters, selectors and every branch that read them.
- The recipe packet end-to-end — `buildFramerateRecipePacket()`, the `0x31` message-type constant, the
  send path, the enable toggle, the "recipe sent" flag and the diagnostics rows derived from it.
- The managed retune: the debounced resend timer, the gated-frame lead ahead of the recipe, and the
  retime/resync steps that followed it. A speed change now moves the clock directly, which removes
  roughly 320 ms between the gesture and the pitch landing.
- Three of the pending-step queue's four arms. Only the jump sequence survives, so the queue is a
  queue of register snapshots rather than a four-arm union.
- The protocol floor on `slowestSpeed`. It existed because the recipe's interval field was sixteen
  bits wide; with no recipe there is no such field, so the slowest speed is the hard span
  (`1 − SPEED_HARD_SPAN`) for every tune. Multispeed tunes that were previously floored by the
  protocol can now be slowed the full range.

## Survived — do not sweep these up

Each of these reads like cartridge machinery and is not:

- **`buildVoiceGateOffSnapshot()` / `withVoiceGatesOff()`.** Called by `pause()` and by a jump landing
  while paused. Both are timing-agnostic and both predate the fallback; only their third call site,
  the gate-off lead inside the retune, died.
- **The pending-step queue itself.** The host paces the stream one frame per tick, so each of the jump
  sequence's two packets needs a frame slot and a due time of its own. The gate-off has to land a
  whole frame ahead of the re-emit or the voices get no release window before they re-attack.
- **Everything under `src/lib/replay/`.** The off-thread scrub worker addresses main-thread stall
  during a deep replay. That has nothing to do with the cartridge's buffer and is untouched.
- **The schedule-ahead knob** (`scheduleAheadMs`, `effectiveScheduleAheadMs()` and the
  uncancellable-port clamp). A live tuning control; its measured default is `0`.
- **The cancel-and-reschedule path on tempo change** (`retimeCommittedHostSends()`,
  `MidiOutputService.supportsCancel()` / `cancelPending()`) and all the delivery instrumentation. That
  is the surviving path's own machinery, not the fallback's.
