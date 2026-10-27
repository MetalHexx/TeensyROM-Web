import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { DeviceBusyError, FileItemType, LaunchMode, PlayerStatus } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

const busy = () => new DeviceBusyError('device-busy', 'job-1', 'Alpha is busy with a transfer.');

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const waitUntil = async (predicate: () => boolean, timeoutMs = 5000, intervalMs = 25) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: condition was not met before timeout');
    }
    await wait(intervalMs);
  }
};

describe('PlayerContextService - device busy refusal', () => {
  const deviceId = 'device-busy';
  const otherDeviceId = 'device-other';

  // Any retry or skip is scheduled through setTimeout at the harness's 0ms retry delay, so one
  // drained macrotask is enough for a wrongly scheduled one to have run.
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const song = (name: string, playLength = '0:30') =>
    createTestFileItem({
      name,
      path: `/music/${name}`,
      parentPath: '/music',
      type: FileItemType.Song,
      playLength,
    });

  describe('user launch', () => {
    let harness: PlayerHarness;

    beforeEach(() => {
      harness = createPlayerHarness();
      harness.service.initializePlayer(deviceId);
      harness.service.initializePlayer(otherDeviceId);
    });

    it('stops the player and leaves the refused file compatible without skipping', async () => {
      const file = song('refused.sid');
      const next = song('next.sid');
      const updateCompatibility = vi.spyOn(harness.storageStore, 'updateFileCompatibility');
      harness.playerService.launchFile = vi.fn(() => throwError(busy));

      await harness.service.launchFileWithContext({
        deviceId,
        file,
        directoryPath: '/music',
        files: [file, next],
      });
      await flush();

      expect(harness.playerService.launchFile).toHaveBeenCalledTimes(1);
      expect(updateCompatibility).not.toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()?.isCompatible).toBe(true);
      expect(harness.service.getStatus(deviceId)()).toBe(PlayerStatus.Stopped);
      expect(harness.service.getError(deviceId)()).toBe('Alpha is busy with a transfer.');
      expect(harness.service.getTimerState(deviceId)()).toBeNull();
    });

    it('keeps launching on other devices', async () => {
      const file = song('refused.sid');
      const other = song('fine.sid');
      harness.playerService.launchFile = vi.fn((id: string) =>
        id === deviceId ? throwError(busy) : of(other)
      );

      await harness.service.launchFileWithContext({
        deviceId,
        file,
        directoryPath: '/music',
        files: [file],
      });
      await harness.service.launchFileWithContext({
        deviceId: otherDeviceId,
        file: other,
        directoryPath: '/music',
        files: [other],
      });

      expect(harness.service.getStatus(deviceId)()).toBe(PlayerStatus.Stopped);
      expect(harness.service.getStatus(otherDeviceId)()).toBe(PlayerStatus.Playing);
      expect(harness.service.getError(otherDeviceId)()).toBeNull();
    });
  });

  describe('shuffle', () => {
    it('keeps the current file and launches nothing further when launch random is refused', async () => {
      const harness = createPlayerHarness();
      harness.service.initializePlayer(deviceId);
      const current = song('current.sid');
      await harness.service.launchFileWithContext({
        deviceId,
        file: current,
        directoryPath: '/music',
        files: [current],
        launchMode: LaunchMode.Shuffle,
      });
      const updateCompatibility = vi.spyOn(harness.storageStore, 'updateFileCompatibility');
      harness.playerService.launchRandom = vi.fn(() => throwError(busy));

      await harness.service.launchRandomFile(deviceId);
      await flush();

      expect(harness.playerService.launchRandom).toHaveBeenCalledTimes(1);
      expect(harness.playerService.launchFile).toHaveBeenCalledTimes(1);
      expect(updateCompatibility).not.toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(current);
      expect(harness.service.getError(deviceId)()).toBe('Alpha is busy with a transfer.');
    });
  });

  describe('auto-advance', () => {
    it('stops the player when the next file is refused and launches nothing after it', async () => {
      // A tick period at or above the timer's duration completes it in one bounded real tick.
      const harness = createPlayerHarness({ timerTickMs: 1100 });
      harness.service.initializePlayer(deviceId);
      const first = song('first.sid', '0:01');
      const second = song('second.sid', '0:01');
      const updateCompatibility = vi.spyOn(harness.storageStore, 'updateFileCompatibility');
      harness.playerService.launchFile = vi
        .fn()
        .mockReturnValueOnce(of(first))
        .mockReturnValue(throwError(busy));

      await harness.service.launchFileWithContext({
        deviceId,
        file: first,
        directoryPath: '/music',
        files: [first, second],
      });

      await waitUntil(() => harness.service.getStatus(deviceId)() === PlayerStatus.Stopped);
      await wait(50);

      expect(harness.playerService.launchFile).toHaveBeenCalledTimes(2);
      expect(updateCompatibility).not.toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()?.file.name).toBe('first.sid');
      expect(harness.service.getError(deviceId)()).toBe('Alpha is busy with a transfer.');
      expect(harness.service.getTimerState(deviceId)()).toBeNull();
      harness.service.removePlayer(deviceId);
    }, 10000);
  });
});
