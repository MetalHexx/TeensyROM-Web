import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MidiOutputService } from '../midi/midi-output.service';
import { DeliveryTransport, UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS } from './delivery';

interface SentPacket {
  readonly bytes: Uint8Array;
  readonly timestampMs: number | undefined;
}

/** The transport double `DeliveryTransport` is built against — see the engine spec's own copy for
 *  why capability and the cancel call are two separate fakes, not one. */
class FakeMidiOutputService {
  supportsCancel = false;
  readonly sent: SentPacket[] = [];
  cancelPendingCallCount = 0;
  cancelPendingReturns = false;

  send(bytes: Uint8Array, timestampMs?: number): void {
    this.sent.push({ bytes: Uint8Array.from(bytes), timestampMs });
  }

  cancelPending(): boolean {
    this.cancelPendingCallCount++;
    return this.cancelPendingReturns;
  }
}

function midiOutputService(midi: FakeMidiOutputService): MidiOutputService {
  return {
    supportsCancel: () => midi.supportsCancel,
    send: (bytes: Uint8Array, timestampMs?: number) => midi.send(bytes, timestampMs),
    cancelPending: () => midi.cancelPending(),
  } as unknown as MidiOutputService;
}

const ONE_INTERVAL_US = 20_000; // 20 ms, a round PAL-ish frame for arithmetic that reads cleanly

function packet(byte: number): Uint8Array {
  return Uint8Array.from([byte]);
}

describe('DeliveryTransport', () => {
  let midi: FakeMidiOutputService;
  let delivery: DeliveryTransport;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    midi = new FakeMidiOutputService();
    delivery = new DeliveryTransport(midiOutputService(midi));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('schedules a frame packet against its due time plus the schedule-ahead window', () => {
    delivery.setScheduleAhead(20);

    delivery.sendFramePacket(packet(1), 1_000_000, false, ONE_INTERVAL_US);

    expect(midi.sent).toHaveLength(1);
    expect(midi.sent[0].timestampMs).toBeCloseTo(1_000_020, 6);
  });

  it('sends a control packet immediately, with no timestamp', () => {
    delivery.sendControl(packet(9));

    expect(midi.sent[0].timestampMs).toBeUndefined();
  });

  it('counts packets and bytes across both send paths', () => {
    delivery.sendControl(packet(1));
    delivery.sendFramePacket(Uint8Array.from([1, 2, 3]), 0, false, ONE_INTERVAL_US);

    const stats = delivery.snapshot();
    expect(stats.packetsSent).toBe(2);
    expect(stats.bytesSent).toBe(4);
  });

  describe('delivery-against-due-time stats', () => {
    it('computes mean and worst lag from known due/hand-off pairs, and flags a frame late past one interval', () => {
      vi.spyOn(performance, 'now').mockReturnValue(100_000);

      delivery.sendFramePacket(packet(1), 100_000, false, ONE_INTERVAL_US); // zero lag
      delivery.sendFramePacket(packet(2), 100_000 - 10, false, ONE_INTERVAL_US); // 10 ms, under one interval
      delivery.sendFramePacket(packet(3), 100_000 - 30, false, ONE_INTERVAL_US); // 30 ms, over one interval

      const stats = delivery.snapshot();
      expect(stats.scheduledFrames).toBe(3);
      expect(stats.worstLagMs).toBeCloseTo(30, 6);
      expect(stats.meanLagMs).toBeCloseTo((0 + 10 + 30) / 3, 6);
      expect(stats.lateFrames).toBe(1);
    });

    it('counts a frame scheduled earlier than its predecessor as reordered', () => {
      delivery.sendFramePacket(packet(1), 1_000_000, false, ONE_INTERVAL_US);
      delivery.sendFramePacket(packet(2), 1_001_000, false, ONE_INTERVAL_US);
      delivery.sendFramePacket(packet(3), 1_000_500, false, ONE_INTERVAL_US); // earlier than its predecessor

      expect(delivery.snapshot().reorderedFrames).toBe(1);
    });

    it('flags a frame emitted from a catch-up-clamped advance, without excluding it from the lag figures', () => {
      delivery.sendFramePacket(packet(1), performance.now(), true, ONE_INTERVAL_US);

      const stats = delivery.snapshot();
      expect(stats.clampedFrames).toBe(1);
      expect(stats.scheduledFrames).toBe(1);
    });
  });

  describe('setScheduleAhead ceiling', () => {
    it('clamps to the uncancellable ceiling when the port cannot cancel pending sends', () => {
      midi.supportsCancel = false;

      delivery.setScheduleAhead(500);

      expect(delivery.scheduleAheadMs()).toBe(UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS);
    });

    it('does not clamp when the port can cancel pending sends', () => {
      midi.supportsCancel = true;

      delivery.setScheduleAhead(500);

      expect(delivery.scheduleAheadMs()).toBe(500);
    });

    it('re-clamps the window actually sent on a mid-session loss of cancel support, without a fresh setScheduleAhead() call', () => {
      midi.supportsCancel = true;
      delivery.setScheduleAhead(200);

      delivery.sendFramePacket(packet(1), 1_000_000, false, ONE_INTERVAL_US);
      expect(midi.sent[0].timestampMs).toBeCloseTo(1_000_000 + 200, 6);

      midi.supportsCancel = false; // a port swap or reconnect, with no fresh setScheduleAhead() call
      expect(delivery.scheduleAheadMs()).toBe(200); // the stored value itself is untouched

      delivery.sendFramePacket(packet(2), 1_001_000, false, ONE_INTERVAL_US);
      expect(midi.sent[1].timestampMs).toBeCloseTo(
        1_001_000 + UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS,
        6
      );
    });

    it('ignores a negative or non-finite value', () => {
      delivery.setScheduleAhead(10);

      delivery.setScheduleAhead(-5);
      delivery.setScheduleAhead(NaN);

      expect(delivery.scheduleAheadMs()).toBe(10);
    });
  });

  describe('reschedule on tempo change', () => {
    it('cancels and re-times every still-committed send once, at the new interval, with a port that can cancel', () => {
      midi.supportsCancel = true;
      midi.cancelPendingReturns = true;
      delivery.setScheduleAhead(200);
      delivery.sendFramePacket(packet(1), 1_000_000, false, ONE_INTERVAL_US);
      delivery.sendFramePacket(packet(2), 1_000_020, false, ONE_INTERVAL_US);
      const committed = midi.sent.map((p) => p.bytes);

      delivery.retimeCommittedHostSends(ONE_INTERVAL_US / 1.2);

      expect(midi.cancelPendingCallCount).toBe(1);
      const resent = midi.sent.slice(-2);
      expect(resent.map((p) => p.bytes)).toEqual(committed);
      const newIntervalMs = ONE_INTERVAL_US / 1.2 / 1000;
      expect((resent[1].timestampMs ?? 0) - (resent[0].timestampMs ?? 0)).toBeCloseTo(newIntervalMs, 6);
    });

    it('never calls cancelPending with a port that cannot cancel', () => {
      midi.supportsCancel = false;
      delivery.sendFramePacket(packet(1), 1_000_000, false, ONE_INTERVAL_US);
      const before = midi.sent.length;

      delivery.retimeCommittedHostSends(ONE_INTERVAL_US);

      expect(midi.cancelPendingCallCount).toBe(0);
      expect(midi.sent.length).toBe(before);
    });

    it('does not resend when cancelPending() reports it did not actually cancel anything', () => {
      midi.supportsCancel = true;
      midi.cancelPendingReturns = false;
      delivery.sendFramePacket(packet(1), 1_000_000, false, ONE_INTERVAL_US);
      const before = midi.sent.length;

      delivery.retimeCommittedHostSends(ONE_INTERVAL_US);

      expect(midi.cancelPendingCallCount).toBe(1);
      expect(midi.sent.length).toBe(before);
    });

    it('re-times only the sends still in the future, never one whose delivery time has already passed', () => {
      midi.supportsCancel = true;
      midi.cancelPendingReturns = true;
      delivery.setScheduleAhead(200);
      delivery.sendFramePacket(packet(1), performance.now() - 1000, false, ONE_INTERVAL_US); // already past due
      delivery.sendFramePacket(packet(2), 1_000_000, false, ONE_INTERVAL_US);
      const before = midi.sent.length;

      delivery.retimeCommittedHostSends(ONE_INTERVAL_US);

      expect(midi.sent.length).toBe(before + 1);
    });

    it('records how far the furthest-out committed send reached past the cancel request', () => {
      midi.supportsCancel = true;
      midi.cancelPendingReturns = true;
      const nowMs = performance.now();
      delivery.setScheduleAhead(200);
      delivery.sendFramePacket(packet(1), nowMs, false, ONE_INTERVAL_US);
      delivery.sendFramePacket(packet(2), nowMs, false, ONE_INTERVAL_US);

      delivery.retimeCommittedHostSends(ONE_INTERVAL_US);

      const stats = delivery.snapshot();
      expect(stats.lastCancelLatencyMs).toBeGreaterThan(100);
      expect(stats.lastCancelLatencyMs).toBeLessThan(300);
    });

    it('falls back to -1 on a mid-session swap to a port that cannot cancel', () => {
      midi.supportsCancel = true;
      midi.cancelPendingReturns = true;
      delivery.setScheduleAhead(200);
      delivery.sendFramePacket(packet(1), performance.now(), false, ONE_INTERVAL_US);
      delivery.retimeCommittedHostSends(ONE_INTERVAL_US);
      expect(delivery.snapshot().lastCancelLatencyMs).toBeGreaterThan(-1);

      midi.supportsCancel = false;

      expect(delivery.snapshot().lastCancelLatencyMs).toBe(-1);
    });
  });

  describe('clearCommitted and reset', () => {
    it('clearCommitted drops what a tempo change could still catch, without touching the running counters', () => {
      midi.supportsCancel = true;
      midi.cancelPendingReturns = true;
      delivery.sendFramePacket(packet(1), 1_000_000, false, ONE_INTERVAL_US);
      const scheduledBefore = delivery.snapshot().scheduledFrames;

      delivery.clearCommitted();
      delivery.retimeCommittedHostSends(ONE_INTERVAL_US); // nothing left to retime

      expect(midi.cancelPendingCallCount).toBe(0);
      expect(delivery.snapshot().scheduledFrames).toBe(scheduledBefore);
    });

    it('reset zeroes every counter this transport owns', () => {
      midi.supportsCancel = true;
      delivery.setScheduleAhead(50);
      delivery.sendFramePacket(packet(1), 1_000_000 - 30, false, ONE_INTERVAL_US);

      delivery.reset();

      const stats = delivery.snapshot();
      expect(stats.packetsSent).toBe(0);
      expect(stats.bytesSent).toBe(0);
      expect(stats.scheduledFrames).toBe(0);
      expect(stats.lateFrames).toBe(0);
      expect(stats.meanLagMs).toBe(0);
      expect(stats.worstLagMs).toBe(0);
      expect(stats.reorderedFrames).toBe(0);
      expect(stats.clampedFrames).toBe(0);
      expect(stats.lastCancelLatencyMs).toBe(-1);
      // scheduleAheadMs is not a counter — a reset must not undo an operator's chosen window.
      expect(delivery.scheduleAheadMs()).toBe(50);
    });
  });
});
