import { describe, it, expect, beforeEach } from 'vitest';
import { frames } from '@sidablist/core';
import type { Frames, PlayRate } from '@sidablist/core';
import { LOOP_AUDITION_PREROLL_MS, MarkerCollection, NUDGE_RANGE_MS } from './marker-collection';
import type { MarkerLoopBounds, MarkerPlayer } from './marker-collection';

type Transport = 'stopped' | 'playing' | 'paused' | 'ended' | 'error';

/**
 * Stands in for `SidPlayer`'s seek and active-loop operations — enough to exercise the collection
 * without a real timeline. PAL's nominal interval and an unmultiplied rate, so 1 frame is 20 ms.
 */
class FakePlayer implements MarkerPlayer {
  private frame: Frames = frames(0);
  private transport: Transport = 'stopped';
  private loop: MarkerLoopBounds | null = null;
  private pendingPlay: (() => void) | null = null;
  private readonly rate: PlayRate = {
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    roundedCallsPerFrame: 1,
    mode: 'exact',
  };

  /** False makes `play()` hang until `resolvePendingPlay()` releases it — what the launch-gate test
   *  needs, to observe `markerLaunchPending` while the await is still in flight. */
  playResolvesImmediately = true;

  readonly seeks: Frames[] = [];
  readonly armedLoops: (MarkerLoopBounds | null)[] = [];
  playCallCount = 0;

  getSnapshot() {
    return {
      transport: this.transport,
      loop: this.loop,
      tempo: { nominalIntervalUs: 20_000, rate: this.rate },
    };
  }

  getPosition(): Frames {
    return this.frame;
  }

  play(): Promise<void> {
    this.playCallCount++;
    if (this.playResolvesImmediately) {
      this.transport = 'playing';
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.pendingPlay = () => {
        this.transport = 'playing';
        resolve();
      };
    });
  }

  resolvePendingPlay(): void {
    this.pendingPlay?.();
    this.pendingPlay = null;
  }

  seek(frame: Frames): Promise<void> {
    this.seeks.push(frame);
    this.frame = frame;
    return Promise.resolve();
  }

  setActiveLoop(loop: MarkerLoopBounds | null): void {
    this.loop = loop;
    this.armedLoops.push(loop);
  }

  setPosition(frame: number): void {
    this.frame = frames(frame);
  }

  setTransport(transport: Transport): void {
    this.transport = transport;
  }
}

describe('MarkerCollection', () => {
  let player: FakePlayer;
  let collection: MarkerCollection;

  beforeEach(() => {
    player = new FakePlayer();
    collection = new MarkerCollection(player);
  });

  describe('marker capture', () => {
    it('captures the current position into a new marker, with no end and no nudge', () => {
      player.setPosition(5);

      const index = collection.addMarker();

      expect(index).toBe(0);
      expect(collection.markers()).toEqual([{ startFrame: 5, startOffsetMs: 0, end: null }]);
    });

    it('is a no-op to trigger, capture into, or delete an out-of-range row', async () => {
      collection.addMarker();

      await collection.triggerMarker(5);
      collection.captureMarkerStart(5);
      collection.deleteMarker(5);

      expect(player.seeks).toHaveLength(0);
      expect(collection.markers()).toHaveLength(1);
    });

    it('refills a row by capturing into it again, landing at the new position and resetting its nudge', () => {
      player.setPosition(5);
      const index = collection.addMarker();
      collection.setMarkerStartOffset(index, 100);

      player.setPosition(10);
      collection.captureMarkerStart(index);

      expect(collection.markers()[index]).toEqual({ startFrame: 10, startOffsetMs: 0, end: null });
    });

    it('deletes a row outright, shifting later indices down', () => {
      collection.addMarker();
      collection.addMarker();

      collection.deleteMarker(0);

      expect(collection.markers()).toHaveLength(1);
    });
  });

  describe('the start nudge', () => {
    it('walks a marker backward onto an earlier frame', async () => {
      player.setPosition(60);
      const index = collection.addMarker();

      collection.setMarkerStartOffset(index, -200); // 200 ms is 10 frames at 20 ms/frame

      await collection.triggerMarker(index);

      expect(player.seeks.at(-1)).toBe(50);
    });

    it('walks a marker forward onto a later frame', async () => {
      player.setPosition(60);
      const index = collection.addMarker();

      collection.setMarkerStartOffset(index, 200);

      await collection.triggerMarker(index);

      expect(player.seeks.at(-1)).toBe(70);
    });

    it('clamps the offset to the nudge range in both directions', () => {
      const index = collection.addMarker();

      collection.setMarkerStartOffset(index, 999_999);
      expect(collection.markers()[index].startOffsetMs).toBe(NUDGE_RANGE_MS);

      collection.setMarkerStartOffset(index, -999_999);
      expect(collection.markers()[index].startOffsetMs).toBe(-NUDGE_RANGE_MS);
    });

    it('never resolves a start before frame 0', async () => {
      player.setPosition(5);
      const index = collection.addMarker();

      collection.setMarkerStartOffset(index, -200); // would resolve to frame -5

      await collection.triggerMarker(index);

      expect(player.seeks.at(-1)).toBe(0);
    });
  });

  describe('converting between cue and loop shape', () => {
    it('an end at or before the start does not resolve to a loop', async () => {
      const index = collection.addMarker(); // start at frame 0
      collection.setMarkerEnd(index); // end also at frame 0 — no pass

      await collection.triggerMarker(index);

      expect(collection.loopingMarker()).toBeNull();
      expect(player.armedLoops.at(-1)).toBeNull();
    });

    it('an end that resolves after the start arms a loop through core, and stopping clears it', async () => {
      const index = collection.addMarker(); // start at frame 0
      player.setPosition(10);
      collection.setMarkerEnd(index); // end at frame 10

      await collection.triggerMarker(index);

      expect(collection.loopingMarker()).toBe(index);
      expect(player.armedLoops.at(-1)).toEqual({ startFrame: 0, endFrame: 10 });

      collection.stopMarkerLoop();

      expect(collection.loopingMarker()).toBeNull();
      expect(player.armedLoops.at(-1)).toBeNull();
    });

    it('setMarkerEnd and clearMarkerEnd convert a row in both directions, preserving its start', () => {
      player.setPosition(5);
      const index = collection.addMarker();

      collection.setMarkerEnd(index);
      expect(collection.markers()[index].end).not.toBeNull();
      expect(collection.markers()[index].startFrame).toBe(5);

      collection.clearMarkerEnd(index);
      expect(collection.markers()[index].end).toBeNull();
      expect(collection.markers()[index].startFrame).toBe(5);
    });

    it('setMarkerEndOffset nudges the end arithmetically, without touching the start', () => {
      const index = collection.addMarker();
      player.setPosition(30);
      collection.setMarkerEnd(index);

      collection.setMarkerEndOffset(index, -400);

      expect(collection.markers()[index].end?.offsetMs).toBe(-400);
      expect(collection.markers()[index].startFrame).toBe(0);
      expect(collection.markers()[index].startOffsetMs).toBe(0);
    });

    it('is a no-op to nudge the end of a row with no end marked', () => {
      const index = collection.addMarker();

      collection.setMarkerEndOffset(index, 100);

      expect(collection.markers()[index].end).toBeNull();
    });

    it('clamps the end offset to the nudge range in both directions', () => {
      const index = collection.addMarker();
      collection.setMarkerEnd(index);

      collection.setMarkerEndOffset(index, 999_999);
      expect(collection.markers()[index].end?.offsetMs).toBe(NUDGE_RANGE_MS);

      collection.setMarkerEndOffset(index, -999_999);
      expect(collection.markers()[index].end?.offsetMs).toBe(-NUDGE_RANGE_MS);
    });
  });

  describe('triggering and the lap queue', () => {
    it('engages a marker at once when nothing is looping', async () => {
      player.setPosition(20);
      const index = collection.addMarker();

      await collection.triggerMarker(index);

      expect(player.seeks.at(-1)).toBe(20);
      expect(collection.loopingMarker()).toBeNull(); // a cue — no end marked
    });

    it('a marker triggered while a loop runs is queued rather than engaged', async () => {
      const loop = collection.addMarker();
      player.setPosition(10);
      collection.setMarkerEnd(loop);
      await collection.triggerMarker(loop);
      const seeksBefore = player.seeks.length;

      const cue = collection.addMarker();
      await collection.triggerMarker(cue);

      expect(collection.loopingMarker()).toBe(loop); // the running lap is unaffected
      expect(collection.queuedMarker()).toBe(cue);
      expect(player.seeks).toHaveLength(seeksBefore); // queued, not engaged
    });

    it('a third trigger replaces a queued marker without disturbing the running lap', async () => {
      const loop = collection.addMarker();
      player.setPosition(10);
      collection.setMarkerEnd(loop);
      await collection.triggerMarker(loop);
      const cueA = collection.addMarker();
      const cueB = collection.addMarker();

      await collection.triggerMarker(cueA);
      await collection.triggerMarker(cueB);

      expect(collection.loopingMarker()).toBe(loop);
      expect(collection.queuedMarker()).toBe(cueB);
    });

    it('re-triggering the marker already looping, with nothing queued, restarts its lap', async () => {
      const loop = collection.addMarker();
      player.setPosition(10);
      collection.setMarkerEnd(loop);
      await collection.triggerMarker(loop);
      player.setPosition(5);
      const seeksBefore = player.seeks.length;

      await collection.triggerMarker(loop);

      expect(player.seeks).toHaveLength(seeksBefore + 1);
      expect(player.seeks.at(-1)).toBe(0);
      expect(collection.loopingMarker()).toBe(loop);
      expect(collection.queuedMarker()).toBeNull();
    });

    it('stopMarkerLoop drops the queue and leaves the playhead alone', async () => {
      const loop = collection.addMarker();
      player.setPosition(10);
      collection.setMarkerEnd(loop);
      await collection.triggerMarker(loop);
      const cue = collection.addMarker();
      await collection.triggerMarker(cue); // queued behind the running lap
      player.setPosition(4);

      collection.stopMarkerLoop();

      expect(collection.loopingMarker()).toBeNull();
      expect(collection.queuedMarker()).toBeNull();
      expect(player.getPosition()).toBe(4); // a get-out, not a move
    });

    it('deleting the looping row clears core’s active loop along with the bookkeeping', async () => {
      const loop = collection.addMarker();
      player.setPosition(10);
      collection.setMarkerEnd(loop);
      await collection.triggerMarker(loop);

      collection.deleteMarker(loop);

      expect(collection.loopingMarker()).toBeNull();
      expect(player.armedLoops.at(-1)).toBeNull();
    });
  });

  describe('the lap-boundary hand-off', () => {
    it('is a no-op while nothing is looping, even when the reading goes backward', () => {
      collection.addMarker(); // start at frame 0, never looped

      collection.noticeLoopPosition(frames(20));
      collection.noticeLoopPosition(frames(5)); // would read as a wrap if a loop were armed

      expect(collection.queuedMarker()).toBeNull();
      expect(player.seeks).toHaveLength(0);
    });

    it('engages the queued loop the instant the running one wraps, clearing the queue', async () => {
      const loop = collection.addMarker(); // start frame 0
      player.setPosition(10);
      collection.setMarkerEnd(loop); // end frame 10
      await collection.triggerMarker(loop);
      const seeksBeforeWrap = player.seeks.length;

      player.setPosition(100);
      const next = collection.addMarker(); // start frame 100
      player.setPosition(120);
      collection.setMarkerEnd(next); // end frame 120 — a second loop, queued behind the first
      await collection.triggerMarker(next);
      expect(collection.queuedMarker()).toBe(next);

      // The lap advances toward the loop's end, sampled once per frame...
      collection.noticeLoopPosition(frames(6));
      collection.noticeLoopPosition(frames(9));
      // ...then core re-enters the loop's start, which the next sample reads as a drop.
      collection.noticeLoopPosition(frames(0));

      expect(collection.loopingMarker()).toBe(next);
      expect(collection.queuedMarker()).toBeNull();
      expect(player.seeks).toHaveLength(seeksBeforeWrap + 1);
      expect(player.seeks.at(-1)).toBe(100); // next's own resolved start
      expect(player.armedLoops.at(-1)).toEqual({ startFrame: 100, endFrame: 120 });
    });

    it('leaves the running lap alone on a wrap with nothing queued', async () => {
      const loop = collection.addMarker();
      player.setPosition(10);
      collection.setMarkerEnd(loop);
      await collection.triggerMarker(loop);

      collection.noticeLoopPosition(frames(9));
      const seeksBeforeWrap = player.seeks.length;
      collection.noticeLoopPosition(frames(0)); // wraps, but nothing is queued behind it

      expect(collection.loopingMarker()).toBe(loop);
      expect(collection.queuedMarker()).toBeNull();
      expect(player.seeks).toHaveLength(seeksBeforeWrap);
    });

    it('does not mistake a steady or advancing reading for a wrap', async () => {
      const loop = collection.addMarker();
      player.setPosition(10);
      collection.setMarkerEnd(loop);
      await collection.triggerMarker(loop);
      const next = collection.addMarker();
      await collection.triggerMarker(next);
      const seeksBeforeWrap = player.seeks.length;

      collection.noticeLoopPosition(frames(3));
      collection.noticeLoopPosition(frames(3)); // repeats the same frame — not a wrap
      collection.noticeLoopPosition(frames(7)); // still advancing

      expect(collection.queuedMarker()).toBe(next);
      expect(player.seeks).toHaveLength(seeksBeforeWrap);
    });

    it('starts a fresh loop with no stale reading from whatever looped before it', async () => {
      const loopA = collection.addMarker(); // start frame 0
      player.setPosition(10);
      collection.setMarkerEnd(loopA); // end frame 10
      await collection.triggerMarker(loopA);
      collection.noticeLoopPosition(frames(8)); // loopA mid-lap, priming lastLoopPosition

      collection.stopMarkerLoop();
      player.setPosition(20);
      const loopB = collection.addMarker(); // start frame 20
      player.setPosition(30);
      collection.setMarkerEnd(loopB); // end frame 30
      await collection.triggerMarker(loopB); // nothing looping — engages at once
      const cue = collection.addMarker();
      await collection.triggerMarker(cue); // queued behind loopB
      const seeksBeforeFirstSample = player.seeks.length;

      // loopB's first sample lands below loopA's last one (8), which would misread as a wrap if that
      // stale reading survived the loop change. It must not: nothing has looped in loopB yet.
      collection.noticeLoopPosition(frames(1));

      expect(collection.queuedMarker()).toBe(cue);
      expect(player.seeks).toHaveLength(seeksBeforeFirstSample);
    });
  });

  describe('the launch gate', () => {
    it('spans triggerMarker’s play() await, then engages once it resolves', async () => {
      player.playResolvesImmediately = false;
      const index = collection.addMarker();

      const trigger = collection.triggerMarker(index);
      expect(collection.markerLaunchPending()).toBe(true);
      expect(player.seeks).toHaveLength(0); // nothing engaged while the launch is in flight

      player.resolvePendingPlay();
      await trigger;

      expect(collection.markerLaunchPending()).toBe(false);
      expect(player.seeks).toHaveLength(1);
    });

    it('skips the launch entirely when already playing', async () => {
      player.setTransport('playing');
      const index = collection.addMarker();

      await collection.triggerMarker(index);

      expect(player.playCallCount).toBe(0);
      expect(collection.markerLaunchPending()).toBe(false);
    });
  });

  describe('the marker audition', () => {
    it('auditionMarkerStart re-enters a row immediately, bypassing the queue', async () => {
      const loop = collection.addMarker();
      player.setPosition(10);
      collection.setMarkerEnd(loop);
      await collection.triggerMarker(loop);
      player.setPosition(5);
      const cue = collection.addMarker(); // a plain cue, further along

      await collection.auditionMarkerStart(cue);

      expect(player.seeks.at(-1)).toBe(5);
      expect(collection.loopingMarker()).toBeNull(); // a cue leaves the loop, same as engaging one does
      expect(collection.queuedMarker()).toBeNull();
    });

    it('auditionMarkerEnd resumes pre-roll frames before the end and arms the loop, without touching the queue', async () => {
      player.setPosition(10);
      const index = collection.addMarker(); // start frame 10
      player.setPosition(210);
      collection.setMarkerEnd(index); // end frame 210

      await collection.auditionMarkerEnd(index);

      const prerollFrames = (LOOP_AUDITION_PREROLL_MS * 1000) / 20_000;
      expect(player.seeks.at(-1)).toBe(210 - prerollFrames);
      expect(player.armedLoops.at(-1)).toEqual({ startFrame: 10, endFrame: 210 });
      expect(collection.loopingMarker()).toBe(index);
      expect(collection.queuedMarker()).toBeNull();
    });

    it('auditionMarkerEnd is a no-op for a row that does not resolve to a loop', async () => {
      const index = collection.addMarker(); // no end marked

      await collection.auditionMarkerEnd(index);

      expect(collection.loopingMarker()).toBeNull();
      expect(player.seeks).toHaveLength(0);
    });
  });

  describe('progressPercentFor', () => {
    it('reads core’s position against the loop it is enforcing for the marker presently looping', async () => {
      const index = collection.addMarker();
      player.setPosition(100);
      collection.setMarkerEnd(index); // start 0, end 100
      await collection.triggerMarker(index);

      player.setPosition(25);
      expect(collection.progressPercentFor(index)).toBe(25);

      player.setPosition(100);
      expect(collection.progressPercentFor(index)).toBe(100);
    });

    it('is 0 for every row that is not the one presently looping', () => {
      const index = collection.addMarker();

      expect(collection.progressPercentFor(index)).toBe(0);
    });
  });
});
