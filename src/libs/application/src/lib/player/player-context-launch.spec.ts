import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { LaunchMode, PlayerStatus, StorageType, FileItemType } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - launch', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-launch';

  beforeEach(() => {
    harness = createPlayerHarness();
  });

  describe('player initialization and cleanup', () => {
    it('initializes player state with no current file and Stopped status', () => {
      harness.service.initializePlayer(deviceId);

      expect(harness.service.getCurrentFile(deviceId)()).toBeNull();
      expect(harness.service.getStatus(deviceId)()).toBe(PlayerStatus.Stopped);
    });

    it('clears the current file when the player is removed', async () => {
      harness.service.initializePlayer(deviceId);
      const file = createTestFileItem();
      await harness.service.launchFileWithContext({
        deviceId,
        file,
        directoryPath: '/music',
        files: [file],
      });

      harness.service.removePlayer(deviceId);

      expect(harness.service.getCurrentFile(deviceId)()).toBeNull();
    });

    it('initializes two devices independently and leaves the other untouched on removal', () => {
      const device1 = 'device-1';
      const device2 = 'device-2';

      harness.service.initializePlayer(device1);
      harness.service.initializePlayer(device2);

      expect(harness.service.getCurrentFile(device1)()).toBeNull();
      expect(harness.service.getCurrentFile(device2)()).toBeNull();
      expect(harness.service.getStatus(device1)()).toBe(PlayerStatus.Stopped);
      expect(harness.service.getStatus(device2)()).toBe(PlayerStatus.Stopped);

      harness.service.removePlayer(device1);

      expect(harness.service.getCurrentFile(device2)()).toBeNull();
      expect(harness.service.getStatus(device2)()).toBe(PlayerStatus.Stopped);
    });
  });

  describe('launchFileWithContext', () => {
    const testFile = createTestFileItem();
    const testFiles = [
      createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid' }),
      createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' }),
      createTestFileItem({ name: 'game.prg', path: '/music/game.prg', type: FileItemType.Game }),
    ];

    beforeEach(() => {
      harness.service.initializePlayer(deviceId);
    });

    it('sets current file, launch mode, and file context, and clears loading and error', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: testFile,
        directoryPath: '/music',
        files: testFiles,
        launchMode: LaunchMode.Directory,
      });

      expect(harness.playerService.launchFile).toHaveBeenCalledWith(deviceId, testFile);

      const currentFile = harness.service.getCurrentFile(deviceId)();
      expect(currentFile?.file).toEqual(testFile);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Directory);

      const fileContext = harness.service.getFileContext(deviceId)();
      expect(fileContext?.files).toEqual(testFiles);
      expect(fileContext?.directoryPath).toBe('/music');
      expect(fileContext?.currentIndex).toBe(0);

      expect(harness.service.isLoading(deviceId)()).toBe(false);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it('records the attempted file and sets error state when the launch API fails', async () => {
      // A failed launch marks the attempted file incompatible, which would otherwise schedule
      // a real auto-advance retry (handleIncompatibleFile) that outlives this test and mutates
      // state after the assertions below. A retry delay past the test's lifetime keeps that
      // retry from ever firing, so it doesn't overwrite the failed-launch state under test.
      const failureHarness = createPlayerHarness({ incompatibleRetryDelayMs: 60_000 });
      failureHarness.service.initializePlayer(deviceId);
      failureHarness.playerService.launchFile = vi.fn(() =>
        throwError(() => new Error('Launch failed'))
      );

      await failureHarness.service.launchFileWithContext({
        deviceId,
        file: testFile,
        directoryPath: '/music',
        files: testFiles,
      });

      expect(failureHarness.service.getError(deviceId)()).toBeTruthy();
      expect(failureHarness.service.isLoading(deviceId)()).toBe(false);

      const currentFile = failureHarness.service.getCurrentFile(deviceId)();
      expect(currentFile).not.toBeNull();
      expect(currentFile?.file.name).toBe(testFile.name);
      expect(currentFile?.file.path).toBe(testFile.path);
    });

    it('defaults to Directory launch mode when none is specified', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: testFile,
        directoryPath: '/music',
        files: testFiles,
      });

      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Directory);
    });

    it('is loading while the launch is pending and stops loading once it resolves', async () => {
      let resolveLaunch: (() => void) | undefined;
      const pending = new Promise<void>((resolve) => {
        resolveLaunch = resolve;
      });
      const delayed = new Observable<ReturnType<typeof createTestFileItem>>((subscriber) => {
        pending.then(() => {
          subscriber.next(testFile);
          subscriber.complete();
        });
      });
      harness.playerService.launchFile = vi.fn(() => delayed);

      const launchPromise = harness.service.launchFileWithContext({
        deviceId,
        file: testFile,
        directoryPath: '/music',
        files: testFiles,
      });

      expect(harness.service.isLoading(deviceId)()).toBe(true);

      resolveLaunch?.();
      await launchPromise;

      expect(harness.service.isLoading(deviceId)()).toBe(false);
    });
  });

  describe('launchRandomFile', () => {
    const storageType = StorageType.Sd;
    const randomFile = createTestFileItem({
      name: 'random-song.sid',
      path: '/games/random-song.sid',
      parentPath: '/games',
    });

    beforeEach(() => {
      harness.service.initializePlayer(deviceId);
    });

    it('sets the current file and Shuffle launch mode', async () => {
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.launchRandomFile(deviceId);

      const currentFile = harness.service.getCurrentFile(deviceId)();
      expect(currentFile?.file).toEqual(randomFile);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);
      expect(harness.service.isLoading(deviceId)()).toBe(false);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it("aligns storage to the launched file's parent directory", async () => {
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));
      const alignSpy = vi.spyOn(harness.storageStore, 'alignToPlayingFile');

      await harness.service.launchRandomFile(deviceId);

      expect(alignSpy).toHaveBeenCalledWith({
        deviceId,
        storageType,
        path: randomFile.parentPath,
      });
    });

    it('still sets the current file when directory alignment fails', async () => {
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));
      vi.spyOn(harness.storageStore, 'alignToPlayingFile').mockRejectedValue(
        new Error('Directory load failed')
      );

      await expect(harness.service.launchRandomFile(deviceId)).resolves.not.toThrow();

      const currentFile = harness.service.getCurrentFile(deviceId)();
      expect(currentFile?.file).toEqual(randomFile);
    });

    it('completes the launch when alignment resolves with no matching directory state', async () => {
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));
      // No directory staged for this device/path, so alignment resolves with nothing to read back.

      await harness.service.launchRandomFile(deviceId);

      const currentFile = harness.service.getCurrentFile(deviceId)();
      expect(currentFile?.file).toEqual(randomFile);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);
    });

    it('sets error state and leaves no current file when the random launch fails', async () => {
      harness.playerService.launchRandom = vi.fn(() =>
        throwError(() => new Error('Random launch failed'))
      );

      await harness.service.launchRandomFile(deviceId);

      expect(harness.service.getError(deviceId)()).toBeTruthy();
      expect(harness.service.getCurrentFile(deviceId)()).toBeNull();
      expect(harness.service.isLoading(deviceId)()).toBe(false);
    });
  });
});
