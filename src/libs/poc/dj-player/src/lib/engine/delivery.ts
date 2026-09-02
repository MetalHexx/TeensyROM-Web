import { signal, WritableSignal } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import type { DeckMidiPort } from '../midi/deck-midi-binding';
import { MICROSECONDS_PER_SECOND } from './engine-utils';

/**
 * The `scheduleAheadMs` ceiling enforced whenever the selected MIDI port cannot cancel a pending
 * send — two PAL frames. That is the whole of the fallback this iteration promises for a port
 * without `clear()`: stale-tempo frames a tempo change can no longer catch still play out, so the
 * window they can be stale for has to stay short enough to be inaudible. A port that *can* cancel has
 * no need of this — `retimeCommittedHostSends()` re-times whatever is still outstanding instead of
 * merely bounding it.
 *
 * Enforced live, at every send, via `effectiveScheduleAheadMs()` — not only at the moment
 * `setScheduleAhead()` runs — because `supportsCancel()` is a signal the deck's `DeckMidiPort` can
 * flip on its own (a port swap, a same-device reconnect) with no call back into the engine.
 */
export const UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS = 40;

/** The delivery-against-due-time counters `DeliveryTransport` publishes for `EngineStats`. */
export interface DeliveryStats {
  readonly packetsSent: number;
  readonly bytesSent: number;
  readonly scheduledFrames: number;
  readonly lateFrames: number;
  readonly meanLagMs: number;
  readonly worstLagMs: number;
  readonly reorderedFrames: number;
  readonly clampedFrames: number;
  readonly cancelSupported: boolean;
  readonly lastCancelLatencyMs: number;
}

/**
 * Everything that happens once the coordinator has a packet and a due time: hands it to the MIDI
 * transport, tracks what is still outstanding for a tempo change to catch, and keeps the
 * delivery-against-due-time counters the diagnostics panel reads.
 *
 * Owns `scheduleAheadMs` — the coordinator re-exposes the signal rather than holding its own, so a
 * write through the engine's field reaches the same clamp logic `setScheduleAhead()` enforces here.
 */
export class DeliveryTransport {
  constructor(private readonly midi: DeckMidiPort) {}

  readonly scheduleAheadMs: WritableSignal<number> = signal<number>(0);

  private packetsSent = 0;
  private bytesSent = 0;
  private scheduledFrames = 0;
  private lateFrames = 0;
  private sumLagMs = 0;
  private worstLagMs = 0;
  private reorderedFrames = 0;
  private clampedFrames = 0;
  private lastCancelLatencyMs = -1;
  /** The previous frame's delivery time, so `recordDeliveryStats` can detect an inversion. Null
   *  before the first frame of a run — there is nothing yet to be earlier than. */
  private lastScheduledAtMs: number | null = null;
  /**
   * Frame packets already handed to the transport with a future delivery time — pruned as each
   * entry's delivery time passes. What a tempo change can still catch: `retimeCommittedHostSends()`
   * cancels the transport's queue and re-sends exactly these, at the new spacing, rather than losing
   * whatever they were carrying.
   */
  private committedHostSends: { readonly packet: Uint8Array; readonly scheduledAtMs: number }[] = [];

  /**
   * `0` sends every packet immediately; a positive value hands `performance.now() + ms` to Web MIDI
   * so the subsystem's own clock releases it. Applied to the frame stream only — control packets
   * still go out at once, so a stop is never queued behind music.
   *
   * Clamped to `UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS` here whenever the selected MIDI port cannot
   * cancel a pending send, so the control itself never shows a deeper window than the current port
   * can safely honour. This is a courtesy at selection time, not the enforcement:
   * `effectiveScheduleAheadMs()` re-derives the live ceiling on every send rather than trusting what
   * got stored here.
   */
  setScheduleAhead(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      logWarn(`DJ engine: ignoring a schedule-ahead of ${ms} ms.`);
      return;
    }
    const clamped = this.midi.supportsCancel()
      ? ms
      : Math.min(ms, UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS);
    if (clamped !== ms) {
      logWarn(
        `DJ engine: clamped schedule-ahead from ${ms} ms to ${clamped} ms — the selected MIDI port ` +
          `cannot cancel a pending send, so a deeper window would risk stale-tempo frames playing out audibly.`
      );
    }
    this.scheduleAheadMs.set(clamped);
  }

  /**
   * The schedule-ahead window actually honoured for the next send, re-derived fresh against the
   * live `supportsCancel()` signal rather than trusted from whatever `setScheduleAhead()` last
   * stored — capability can flip on its own (a port swap, a same-device reconnect) with no matching
   * call back into `setScheduleAhead()`.
   */
  private effectiveScheduleAheadMs(): number {
    const ms = this.scheduleAheadMs();
    return this.midi.supportsCancel() ? ms : Math.min(ms, UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS);
  }

  /**
   * Sends one frame packet, scheduled against `dueAtMs + effectiveScheduleAheadMs()`: `dueAtMs` is
   * when the clock says this frame fell due, always at or before now, so anchoring to it rather than
   * to whenever the main thread reached the packet is what makes packet spacing independent of
   * callback timing.
   *
   * `intervalUs` is the coordinator's own `effectiveIntervalUs()` at send time — handed in rather
   * than re-derived here, since the tune's rate is the coordinator's to know, not this transport's.
   */
  sendFramePacket(packet: Uint8Array, dueAtMs: number, catchUpClamped: boolean, intervalUs: number): void {
    const handOffMs = performance.now();
    const scheduledAtMs = dueAtMs + this.effectiveScheduleAheadMs();
    this.midi.send(packet, scheduledAtMs);
    this.recordCommittedHostSend(packet, scheduledAtMs);
    this.packetsSent++;
    this.bytesSent += packet.length;
    this.recordDeliveryStats(dueAtMs, handOffMs, scheduledAtMs, catchUpClamped, intervalUs);
  }

  sendControl(packet: Uint8Array): void {
    this.midi.send(packet);
    this.packetsSent++;
    this.bytesSent += packet.length;
  }

  /** Updates the delivery-against-due-time counters `snapshot()` reports. */
  private recordDeliveryStats(
    dueAtMs: number,
    handOffMs: number,
    scheduledAtMs: number,
    catchUpClamped: boolean,
    intervalUs: number
  ): void {
    this.scheduledFrames++;
    const lagMs = handOffMs - dueAtMs;
    this.sumLagMs += lagMs;
    if (lagMs > this.worstLagMs) {
      this.worstLagMs = lagMs;
    }
    const oneIntervalMs = intervalUs / (MICROSECONDS_PER_SECOND / 1000);
    if (lagMs > oneIntervalMs) {
      this.lateFrames++;
    }
    if (catchUpClamped) {
      this.clampedFrames++;
    }
    if (this.lastScheduledAtMs !== null && scheduledAtMs < this.lastScheduledAtMs) {
      this.reorderedFrames++;
    }
    this.lastScheduledAtMs = scheduledAtMs;
  }

  /** Drops whatever has already reached its scheduled delivery time before recording the newest
   *  send, so `committedHostSends` never holds more than a tempo change could actually still catch. */
  private pruneCommittedHostSends(nowMs: number): void {
    this.committedHostSends = this.committedHostSends.filter((entry) => entry.scheduledAtMs > nowMs);
  }

  /** Records a send a tempo change could still catch — and only such a send. One whose delivery time
   *  has already passed, because the main thread stalled between the frame falling due and reaching
   *  the transport, has been handed over for immediate release: there is nothing left to cancel or
   *  re-time, so it never belonged in this collection. */
  private recordCommittedHostSend(packet: Uint8Array, scheduledAtMs: number): void {
    const nowMs = performance.now();
    this.pruneCommittedHostSends(nowMs);
    if (scheduledAtMs > nowMs) {
      this.committedHostSends.push({ packet, scheduledAtMs });
    }
  }

  /**
   * The cancellation half of a tempo change.
   *
   * With a port that can cancel, whatever is still sitting in the transport's queue was scheduled
   * against the old interval and would land at the wrong spacing; wiping it and re-sending the same
   * packets at the new one is what "re-time" means here — the content is unchanged, only the
   * delivery times move. Without cancellation, or when `cancelPending()` reports it did not actually
   * cancel anything, this is a no-op: resending on top of sends the transport still holds would
   * duplicate them, so `setScheduleAhead()`'s clamp is what keeps that window inaudible instead.
   *
   * `intervalUs` is the coordinator's newly effective interval, for the same reason `sendFramePacket`
   * takes one — the rate belongs to the coordinator, not this transport.
   */
  retimeCommittedHostSends(intervalUs: number): void {
    const nowMs = performance.now();
    this.pruneCommittedHostSends(nowMs);
    if (this.committedHostSends.length === 0 || !this.midi.supportsCancel()) {
      return;
    }
    if (!this.midi.cancelPending()) {
      return;
    }

    const outstanding = this.committedHostSends;
    // The furthest-out entry is the one that would have kept arriving longest without the cancel —
    // how far past this request it was still committed to land is the cancel's measured reach.
    this.lastCancelLatencyMs = Math.max(...outstanding.map((entry) => entry.scheduledAtMs)) - nowMs;
    this.committedHostSends = [];
    // `supportsCancel()` is already confirmed true above, so this equals `scheduleAheadMs()` — read
    // via the same helper `sendFramePacket` uses purely so both call sites agree on one source of
    // truth for "the window actually in effect right now."
    const aheadMs = this.effectiveScheduleAheadMs();
    const newIntervalMs = intervalUs / (MICROSECONDS_PER_SECOND / 1000);
    // The same `nowMs` the latency above was measured against: a second reading would put the
    // measurement and the first re-sent packet on two different anchors.
    let scheduledAtMs = nowMs + aheadMs;
    for (const { packet } of outstanding) {
      this.midi.send(packet, scheduledAtMs);
      this.committedHostSends.push({ packet, scheduledAtMs });
      scheduledAtMs += newIntervalMs;
    }
  }

  /** Drops every send a tempo change could still catch, without touching the running counters —
   *  what a pause or a stop needs: nothing is coming to land them, but the session's totals so far
   *  still stand. */
  clearCommitted(): void {
    this.committedHostSends = [];
  }

  /** Zeroes every counter this transport owns — a fresh tune or a fresh play run starts a clean
   *  delivery record. */
  reset(): void {
    this.packetsSent = 0;
    this.bytesSent = 0;
    this.committedHostSends = [];
    this.scheduledFrames = 0;
    this.lateFrames = 0;
    this.sumLagMs = 0;
    this.worstLagMs = 0;
    this.reorderedFrames = 0;
    this.clampedFrames = 0;
    this.lastCancelLatencyMs = -1;
    this.lastScheduledAtMs = null;
  }

  /** The counters `EngineStats` reports, assembled fresh on every publish. */
  snapshot(): DeliveryStats {
    const cancelSupported = this.midi.supportsCancel();
    return {
      packetsSent: this.packetsSent,
      bytesSent: this.bytesSent,
      scheduledFrames: this.scheduledFrames,
      lateFrames: this.lateFrames,
      meanLagMs: this.scheduledFrames === 0 ? 0 : this.sumLagMs / this.scheduledFrames,
      worstLagMs: this.worstLagMs,
      reorderedFrames: this.reorderedFrames,
      clampedFrames: this.clampedFrames,
      cancelSupported,
      // Derived rather than read straight off the field: `this.lastCancelLatencyMs` is sticky
      // across a mid-session port swap, so a swap to a non-cancelling port must force this back to
      // -1 rather than surface a stale reading from the port it replaced.
      lastCancelLatencyMs: cancelSupported ? this.lastCancelLatencyMs : -1,
    };
  }
}
