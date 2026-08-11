import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { FileItemType, LaunchMode } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import type { WritableStore } from './player-helpers';
import type { PlayerState } from './player-store';
import { DEFAULT_TIMER_MS } from './player.constants';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Polls instead of a single fixed real-time wait, since the real timer tick rate under
// PLAYER_TIMER_TICK_MS=0 varies with machine load - this settles as soon as the condition is
// true rather than always paying a worst-case delay, while still bounding total wait time.
const waitUntil = async (predicate: () => boolean, timeoutMs = 5000, intervalMs = 25) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: condition was not met before timeout');
    }
    await wait(intervalMs);
  }
};

describe('PlayerContextService - play timer', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-timer';

  beforeEach(() => {
    // A failed launch marks the attempted file incompatible, which would otherwise schedule a
    // real handleIncompatibleFile retry that outlives a test - a long delay keeps that retry
    // from ever firing here; none of this file's tests exercise that retry itself.
    harness = createPlayerHarness({ incompatibleRetryDelayMs: 60_000 });
    harness.service.initializePlayer(deviceId);
  });

  describe('compatibility gate on playback controls', () => {
    it('blocks play() and pause() on an incompatible file, but always allows stop()', async () => {
      const incompatibleFile = createTestFileItem({ isCompatible: false });
      await harness.service.launchFileWithContext({
        deviceId,
        file: incompatibleFile,
        directoryPath: '/music',
        files: [incompatibleFile],
      });
      expect(harness.service.getTimerState(deviceId)()).toBeNull();

      await harness.service.play(deviceId);
      expect(harness.playerService.toggleMusic).not.toHaveBeenCalled();

      await harness.service.pause(deviceId);
      expect(harness.playerService.toggleMusic).not.toHaveBeenCalled();

      await harness.service.stop(deviceId);
      expect(harness.deviceService.resetDevice).toHaveBeenCalledWith(deviceId);
    });
  });

  describe('timer creation from file metadata', () => {
    it.each([
      ['3:45', 225000],
      ['1:23:45', 5025000],
    ])('sizes the timer to a parsed %s playLength (%dms)', async (playLength, totalTime) => {
      const musicFile = createTestFileItem({ type: FileItemType.Song, playLength });
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });

      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(totalTime);
    });

    it('creates no timer for a non-music file', async () => {
      const imageFile = createTestFileItem({ type: FileItemType.Image, playLength: undefined });
      await harness.service.launchFileWithContext({
        deviceId,
        file: imageFile,
        directoryPath: '/images',
        files: [imageFile],
      });

      expect(harness.service.getTimerState(deviceId)()).toBeNull();
    });

    it.each([
      ['invalid', 'invalid playLength format'],
      ['', 'empty playLength'],
    ])('falls back to the 3-minute default and warns when playLength is %j', async (playLength, warningText) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const musicFile = createTestFileItem({ type: FileItemType.Song, playLength });

      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });

      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(DEFAULT_TIMER_MS);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(warningText));
      warnSpy.mockRestore();
    });
  });

  describe('timer tracks playback controls', () => {
    it('pauses on pause(), freezes currentTime, resumes on play(), and resets to 0 on stop()', async () => {
      const musicFile = createTestFileItem({ type: FileItemType.Song, playLength: '3:45' });
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });

      await harness.service.pause(deviceId);
      expect(harness.service.getTimerState(deviceId)()?.isRunning).toBe(false);
      const pausedTime = harness.service.getTimerState(deviceId)()?.currentTime;
      await wait(20);
      expect(harness.service.getTimerState(deviceId)()?.currentTime).toBe(pausedTime);

      await harness.service.play(deviceId);
      expect(harness.service.getTimerState(deviceId)()?.isRunning).toBe(true);

      await harness.service.stop(deviceId);
      expect(harness.service.getTimerState(deviceId)()?.currentTime).toBe(0);
      expect(harness.service.getTimerState(deviceId)()?.isRunning).toBe(false);
    });

    it('advances currentTime over elapsed real time while running', async () => {
      const musicFile = createTestFileItem({ type: FileItemType.Song, playLength: '3:45' });
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });

      const initial = harness.service.getTimerState(deviceId)()?.currentTime ?? 0;
      await wait(50);
      expect(harness.service.getTimerState(deviceId)()?.currentTime).toBeGreaterThan(initial);
    });

    it('never throws and never creates a timer when playback controls run on a non-music file', async () => {
      const imageFile = createTestFileItem({ type: FileItemType.Image, playLength: undefined });
      await harness.service.launchFileWithContext({
        deviceId,
        file: imageFile,
        directoryPath: '/images',
        files: [imageFile],
      });

      await harness.service.pause(deviceId);
      await harness.service.play(deviceId);
      await harness.service.stop(deviceId);

      expect(harness.service.getTimerState(deviceId)()).toBeNull();
    });
  });

  describe('timer resets on navigation', () => {
    it('creates a fresh timer sized to the newly launched file on next()', async () => {
      const musicFile1 = createTestFileItem({
        type: FileItemType.Song,
        playLength: '3:00',
        path: '/music/music1.sid',
      });
      const musicFile2 = createTestFileItem({
        type: FileItemType.Song,
        playLength: '4:30',
        path: '/music/music2.sid',
      });
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile1,
        directoryPath: '/music',
        files: [musicFile1, musicFile2],
      });
      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(180000);

      await harness.service.next(deviceId);

      const timer = harness.service.getTimerState(deviceId)();
      expect(timer?.totalTime).toBe(270000);
      expect(timer?.currentTime).toBeLessThan(1000);
    });

    it('destroys the timer when navigating from a music file to a non-music file, and creates one going the other way', async () => {
      const musicFile = createTestFileItem({
        type: FileItemType.Song,
        playLength: '3:00',
        path: '/music/song.sid',
      });
      const imageFile = createTestFileItem({
        type: FileItemType.Image,
        playLength: undefined,
        path: '/music/image.gif',
      });
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile, imageFile],
      });
      expect(harness.service.getTimerState(deviceId)()).not.toBeNull();

      await harness.service.next(deviceId);
      expect(harness.service.getTimerState(deviceId)()).toBeNull();

      await harness.service.next(deviceId);
      expect(harness.service.getTimerState(deviceId)()).not.toBeNull();
    });
  });

  describe('auto-progression on timer completion', () => {
    // TimerService increments currentTime by max(PLAYER_TIMER_TICK_MS, 1) on every real tick,
    // so at the harness's default 0ms tick the OS's real timer-resolution floor (tens of ms
    // per tick on some platforms) can turn a nominal 1-second timer into a multi-second wait.
    // A tick period at or above the timer's own duration completes it in a single, bounded
    // real tick instead.
    it('auto-launches the next directory file when the timer completes', async () => {
      const fastCompletionHarness = createPlayerHarness({ timerTickMs: 1100 });
      fastCompletionHarness.service.initializePlayer(deviceId);
      const musicFile1 = createTestFileItem({
        type: FileItemType.Song,
        playLength: '0:01',
        path: '/music/music1.sid',
        name: 'music1.sid',
      });
      const musicFile2 = createTestFileItem({
        type: FileItemType.Song,
        playLength: '0:02',
        path: '/music/music2.sid',
        name: 'music2.sid',
      });
      await fastCompletionHarness.service.launchFileWithContext({
        deviceId,
        file: musicFile1,
        directoryPath: '/music',
        files: [musicFile1, musicFile2],
      });

      await waitUntil(
        () => fastCompletionHarness.service.getCurrentFile(deviceId)()?.file.name === 'music2.sid'
      );

      expect(fastCompletionHarness.playerService.launchFile).toHaveBeenCalledTimes(2);
      // The file it landed on gets its own timer, sized to that file's duration.
      expect(fastCompletionHarness.service.getTimerState(deviceId)()?.totalTime).toBe(2000);
      // music2's own timer is still running on this same fast tick; tear it down so it
      // doesn't complete again later and reach into this test's already-destroyed injector.
      fastCompletionHarness.service.removePlayer(deviceId);
    }, 10000);

    it('triggers a random launch instead when the timer completes in Shuffle mode', async () => {
      const fastCompletionHarness = createPlayerHarness({ timerTickMs: 1100 });
      fastCompletionHarness.service.initializePlayer(deviceId);
      const musicFile1 = createTestFileItem({
        type: FileItemType.Song,
        playLength: '0:01',
        path: '/music/music1.sid',
        name: 'music1.sid',
      });
      const randomFile = createTestFileItem({
        type: FileItemType.Song,
        playLength: '0:01',
        path: '/music/random.sid',
        name: 'random.sid',
      });
      fastCompletionHarness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await fastCompletionHarness.service.launchFileWithContext({
        deviceId,
        file: musicFile1,
        directoryPath: '/music',
        files: [musicFile1],
        launchMode: LaunchMode.Shuffle,
      });

      // Wait for the new file's own timer too, not just the current-file swap - next()'s
      // shuffle branch awaits a directory-context load between the two, so settling only on
      // getCurrentFile risks tearing this harness down while that in-flight work still holds it.
      await waitUntil(
        () =>
          fastCompletionHarness.service.getCurrentFile(deviceId)()?.file.name === 'random.sid' &&
          fastCompletionHarness.service.getTimerState(deviceId)() !== null
      );

      expect(fastCompletionHarness.playerService.launchRandom).toHaveBeenCalledTimes(1);
      // The random file's own timer is still running on this same fast tick; tear it down so
      // it doesn't complete again later and reach into this test's already-destroyed injector.
      fastCompletionHarness.service.removePlayer(deviceId);
    }, 10000);

    it('never auto-progresses while the timer is paused', async () => {
      const musicFile = createTestFileItem({ type: FileItemType.Song, playLength: '0:01' });
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });

      await harness.service.pause(deviceId);
      await wait(150);

      expect(harness.playerService.launchFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('timer state around launch failures', () => {
    it('never creates a timer from a failed directory or random launch, and records the error', async () => {
      const musicFile = createTestFileItem({ type: FileItemType.Song });
      harness.playerService.launchFile = vi.fn(() => throwError(() => new Error('Launch failed')));
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });
      expect(harness.service.getTimerState(deviceId)()).toBeNull();

      harness.service.removePlayer(deviceId);
      harness.service.initializePlayer(deviceId);
      harness.playerService.launchRandom = vi.fn(() => throwError(() => new Error('Random failed')));
      await harness.service.launchRandomFile(deviceId);

      expect(harness.service.getTimerState(deviceId)()).toBeNull();
      expect(harness.service.getError(deviceId)()).toBeTruthy();
    });

    it.each(['next', 'previous'] as const)(
      'tears down the running timer and sets an error when %s() fails to launch',
      async (direction) => {
        const files = [
          createTestFileItem({ type: FileItemType.Song, path: '/music/song1.sid' }),
          createTestFileItem({ type: FileItemType.Song, path: '/music/song2.sid' }),
        ];
        await harness.service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/music',
          files,
        });
        expect(harness.service.getTimerState(deviceId)()).not.toBeNull();

        harness.playerService.launchFile = vi.fn(() =>
          throwError(() => new Error(`${direction} failed`))
        );
        await harness.service[direction](deviceId);

        expect(harness.service.getError(deviceId)()).toBeTruthy();
        expect(harness.service.getTimerState(deviceId)()).toBeNull();
      }
    );

    it('tears down the timer on a second failing launch, then creates a fresh one on the next success', async () => {
      const musicFile1 = createTestFileItem({ type: FileItemType.Song, path: '/music/song1.sid' });
      const musicFile2 = createTestFileItem({
        type: FileItemType.Song,
        playLength: '4:00',
        path: '/music/song2.sid',
      });
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile1,
        directoryPath: '/music',
        files: [musicFile1],
      });
      expect(harness.service.getTimerState(deviceId)()).not.toBeNull();

      harness.playerService.launchFile = vi.fn(() => throwError(() => new Error('failed')));
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile2,
        directoryPath: '/music',
        files: [musicFile2],
      });
      expect(harness.service.getTimerState(deviceId)()).toBeNull();
      expect(harness.service.getError(deviceId)()).toBeTruthy();

      harness.playerService.launchFile = vi.fn(() => of(musicFile2));
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile2,
        directoryPath: '/music',
        files: [musicFile2],
      });
      expect(harness.service.getError(deviceId)()).toBeNull();
      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(240000);
    });
  });

  describe('per-device timer isolation', () => {
    it('keeps timers independent across devices, including pausing and removal', async () => {
      const other = 'device-timer-other';
      harness.service.initializePlayer(other);
      const file1 = createTestFileItem({ type: FileItemType.Song, playLength: '3:00' });
      const file2 = createTestFileItem({ type: FileItemType.Song, playLength: '5:00' });
      await harness.service.launchFileWithContext({
        deviceId,
        file: file1,
        directoryPath: '/music',
        files: [file1],
      });
      await harness.service.launchFileWithContext({
        deviceId: other,
        file: file2,
        directoryPath: '/music',
        files: [file2],
      });

      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(180000);
      expect(harness.service.getTimerState(other)()?.totalTime).toBe(300000);

      await harness.service.pause(deviceId);
      expect(harness.service.getTimerState(deviceId)()?.isRunning).toBe(false);
      expect(harness.service.getTimerState(other)()?.isRunning).toBe(true);

      harness.service.removePlayer(deviceId);
      expect(harness.service.getTimerState(deviceId)()).toBeNull();
      expect(harness.service.getTimerState(other)()?.totalTime).toBe(300000);
    });
  });

  describe('timer query edge cases', () => {
    it('returns null for an unknown device and for a freshly initialized one', () => {
      expect(harness.service.getTimerState('unknown-device')()).toBeNull();
      expect(harness.service.getTimerState(deviceId)()).toBeNull();
    });

    it('leaves the timer in a clean stopped state after a rapid pause/play/pause/play/stop sequence', async () => {
      const musicFile = createTestFileItem({ type: FileItemType.Song });
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });

      await harness.service.pause(deviceId);
      await harness.service.play(deviceId);
      await harness.service.pause(deviceId);
      await harness.service.play(deviceId);
      await harness.service.stop(deviceId);

      const timer = harness.service.getTimerState(deviceId)();
      expect(timer?.currentTime).toBe(0);
      expect(timer?.isRunning).toBe(false);
    });
  });

  describe('custom play timer configuration', () => {
    it('defaults to disabled with DEFAULT_TIMER_MS, for both a fresh device and an unknown one', () => {
      expect(harness.service.getPlayTimerConfig(deviceId)()).toEqual({
        enabled: false,
        durationMs: DEFAULT_TIMER_MS,
      });
      expect(harness.service.getPlayTimerConfig('unknown-device')()).toBeNull();
    });

    it('survives a launch unchanged until explicitly set', async () => {
      const gameFile = createTestFileItem({ type: FileItemType.Game });
      await harness.service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile],
      });

      expect(harness.service.getPlayTimerConfig(deviceId)()).toEqual({
        enabled: false,
        durationMs: DEFAULT_TIMER_MS,
      });
    });

    it('tracks enable, duration updates, and disable through a sequence of setCustomTimer calls', () => {
      harness.service.setCustomTimer(deviceId, true, 30000);
      expect(harness.service.getPlayTimerConfig(deviceId)()).toEqual({
        enabled: true,
        durationMs: 30000,
      });

      harness.service.setCustomTimer(deviceId, true, 60000);
      expect(harness.service.getPlayTimerConfig(deviceId)()).toEqual({
        enabled: true,
        durationMs: 60000,
      });

      harness.service.setCustomTimer(deviceId, false, 60000);
      expect(harness.service.getPlayTimerConfig(deviceId)()).toEqual({
        enabled: false,
        durationMs: 60000,
      });
    });

    it('a previously obtained config signal keeps reflecting changes made via setCustomTimer', () => {
      const configSignal = harness.service.getPlayTimerConfig(deviceId);

      harness.service.setCustomTimer(deviceId, true, 50000);

      expect(configSignal()).toEqual({ enabled: true, durationMs: 50000 });
    });

    it('updates the currently playing non-song file immediately, without disturbing its status', async () => {
      const gameFile = createTestFileItem({ type: FileItemType.Game });
      await harness.service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile],
      });
      expect(harness.service.getTimerState(deviceId)()).toBeNull();
      const statusBefore = harness.service.getPlayerStatus(deviceId)();

      harness.service.setCustomTimer(deviceId, true, 20000);
      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(20000);
      expect(harness.service.getCurrentFile(deviceId)()?.file.name).toBe(gameFile.name);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(statusBefore);

      harness.service.setCustomTimer(deviceId, false, 20000);
      expect(harness.service.getTimerState(deviceId)()).toBeNull();
    });

    it('a song file always times via metadata, ignoring an enabled custom timer', async () => {
      harness.service.setCustomTimer(deviceId, true, 30000);
      const musicFile = createTestFileItem({ type: FileItemType.Song, playLength: '3:45' });

      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });

      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(225000);
    });

    it.each([FileItemType.Game, FileItemType.Image])(
      'a %s file gets the custom duration when the custom timer is enabled',
      async (type) => {
        harness.service.setCustomTimer(deviceId, true, 15000);
        const file = createTestFileItem({ type, playLength: undefined });

        await harness.service.launchFileWithContext({
          deviceId,
          file,
          directoryPath: '/files',
          files: [file],
        });

        expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(15000);
      }
    );

    it('a hex file is excluded from timers regardless of the custom timer setting', async () => {
      harness.service.setCustomTimer(deviceId, true, 15000);
      const hexFile = createTestFileItem({ type: FileItemType.Hex, playLength: undefined });

      await harness.service.launchFileWithContext({
        deviceId,
        file: hexFile,
        directoryPath: '/files',
        files: [hexFile],
      });

      expect(harness.service.getTimerState(deviceId)()).toBeNull();
    });

    it.each([FileItemType.Game, FileItemType.Image])(
      'a %s file gets no timer when the custom timer is disabled',
      async (type) => {
        const file = createTestFileItem({ type, playLength: undefined });

        await harness.service.launchFileWithContext({
          deviceId,
          file,
          directoryPath: '/files',
          files: [file],
        });

        expect(harness.service.getTimerState(deviceId)()).toBeNull();
      }
    );

    it('applies a duration update mid-session only to the following launch', async () => {
      harness.service.setCustomTimer(deviceId, true, 30000);
      const file1 = createTestFileItem({ type: FileItemType.Game, playLength: undefined, path: '/games/a.prg' });
      await harness.service.launchFileWithContext({
        deviceId,
        file: file1,
        directoryPath: '/games',
        files: [file1],
      });
      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(30000);

      harness.service.setCustomTimer(deviceId, true, 5000);
      const file2 = createTestFileItem({ type: FileItemType.Game, playLength: undefined, path: '/games/b.prg' });
      await harness.service.launchFileWithContext({
        deviceId,
        file: file2,
        directoryPath: '/games',
        files: [file2],
      });
      expect(harness.service.getTimerState(deviceId)()?.totalTime).toBe(5000);
    });
  });

  describe('isSlowLoading', () => {
    const setDeviceLoading = (
      targetHarness: PlayerHarness,
      targetDeviceId: string,
      isLoading: boolean
    ) => {
      updateState(
        targetHarness.playerStore as unknown as WritableStore<PlayerState>,
        'test-set-loading',
        (state) => ({
          players: {
            ...state.players,
            [targetDeviceId]: { ...state.players[targetDeviceId], isLoading },
          },
        })
      );
    };

    it('is false with no devices, and stays false while devices are idle', () => {
      expect(harness.service.isSlowLoading()()).toBe(false);
      expect(harness.service.isSlowLoading()()).toBe(false);
    });

    it('caches and returns the same signal instance on repeated calls', () => {
      expect(harness.service.isSlowLoading()).toBe(harness.service.isSlowLoading());
    });

    it('trips true once loading has run continuously past the threshold, and clears immediately on completion', async () => {
      const slowHarness = createPlayerHarness({ launchDelayMs: 40 });
      slowHarness.service.initializePlayer(deviceId);
      const signal = slowHarness.service.isSlowLoading();

      setDeviceLoading(slowHarness, deviceId, true);
      TestBed.flushEffects();
      expect(signal()).toBe(false);

      await wait(70);
      TestBed.flushEffects();
      expect(signal()).toBe(true);

      setDeviceLoading(slowHarness, deviceId, false);
      TestBed.flushEffects();
      expect(signal()).toBe(false);
    });

    it('never trips for a load that completes before the threshold', async () => {
      const slowHarness = createPlayerHarness({ launchDelayMs: 60 });
      slowHarness.service.initializePlayer(deviceId);
      const signal = slowHarness.service.isSlowLoading();

      setDeviceLoading(slowHarness, deviceId, true);
      TestBed.flushEffects();
      await wait(20);
      setDeviceLoading(slowHarness, deviceId, false);
      TestBed.flushEffects();

      await wait(80);
      TestBed.flushEffects();
      expect(signal()).toBe(false);
    });

    it('is true if any of several devices is slow-loading, and only clears once all finish', async () => {
      const slowHarness = createPlayerHarness({ launchDelayMs: 30 });
      const other = 'device-timer-other';
      slowHarness.service.initializePlayer(deviceId);
      slowHarness.service.initializePlayer(other);
      const signal = slowHarness.service.isSlowLoading();

      setDeviceLoading(slowHarness, deviceId, true);
      setDeviceLoading(slowHarness, other, true);
      TestBed.flushEffects();
      await wait(50);
      TestBed.flushEffects();
      expect(signal()).toBe(true);

      setDeviceLoading(slowHarness, deviceId, false);
      TestBed.flushEffects();
      expect(signal()).toBe(true);

      setDeviceLoading(slowHarness, other, false);
      TestBed.flushEffects();
      expect(signal()).toBe(false);
    });

    it('stays true after removing one slow-loading device while another is still loading', async () => {
      const slowHarness = createPlayerHarness({ launchDelayMs: 30 });
      const other = 'device-timer-other';
      slowHarness.service.initializePlayer(deviceId);
      slowHarness.service.initializePlayer(other);
      const signal = slowHarness.service.isSlowLoading();

      setDeviceLoading(slowHarness, deviceId, true);
      setDeviceLoading(slowHarness, other, true);
      TestBed.flushEffects();
      await wait(50);
      TestBed.flushEffects();
      expect(signal()).toBe(true);

      slowHarness.service.removePlayer(deviceId);
      TestBed.flushEffects();
      expect(signal()).toBe(true);

      setDeviceLoading(slowHarness, other, false);
      TestBed.flushEffects();
      expect(signal()).toBe(false);
    });

    it('never trips for many short back-to-back loading spans that individually stay under the threshold', async () => {
      const slowHarness = createPlayerHarness({ launchDelayMs: 50 });
      slowHarness.service.initializePlayer(deviceId);
      const signal = slowHarness.service.isSlowLoading();

      for (let i = 0; i < 5; i++) {
        setDeviceLoading(slowHarness, deviceId, true);
        TestBed.flushEffects();
        await wait(20);
        setDeviceLoading(slowHarness, deviceId, false);
        TestBed.flushEffects();
        await wait(10);
      }

      expect(signal()).toBe(false);
    });

    it('a real launch that takes longer than the threshold trips the signal, then clears once it resolves', async () => {
      const slowHarness = createPlayerHarness({ launchDelayMs: 30 });
      slowHarness.service.initializePlayer(deviceId);
      const signal = slowHarness.service.isSlowLoading();
      const testFile = createTestFileItem();
      slowHarness.playerService.launchFile = vi.fn(
        () =>
          new Observable((subscriber) => {
            setTimeout(() => {
              subscriber.next(testFile);
              subscriber.complete();
            }, 80);
          })
      );

      const launchPromise = slowHarness.service.launchFileWithContext({
        deviceId,
        file: testFile,
        directoryPath: '/music',
        files: [testFile],
      });

      await wait(50);
      TestBed.flushEffects();
      expect(signal()).toBe(true);

      await launchPromise;
      TestBed.flushEffects();
      expect(signal()).toBe(false);
    });

    it('a real launch faster than the threshold never trips the signal', async () => {
      const slowHarness = createPlayerHarness({ launchDelayMs: 60 });
      slowHarness.service.initializePlayer(deviceId);
      const signal = slowHarness.service.isSlowLoading();
      const testFile = createTestFileItem();
      slowHarness.playerService.launchFile = vi.fn(() => of(testFile));

      await slowHarness.service.launchFileWithContext({
        deviceId,
        file: testFile,
        directoryPath: '/music',
        files: [testFile],
      });

      await wait(90);
      TestBed.flushEffects();
      expect(signal()).toBe(false);
    });
  });
});
