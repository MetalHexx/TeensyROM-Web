import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { LaunchMode, PlayerFilterType, PlayerScope } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - shuffle', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-shuffle';

  beforeEach(() => {
    harness = createPlayerHarness();
    harness.service.initializePlayer(deviceId);
  });

  describe('toggleShuffleMode', () => {
    it('switches from Directory to Shuffle mode', () => {
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Directory);

      harness.service.toggleShuffleMode(deviceId);

      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);
    });

    it('switches back to Directory mode on a second toggle', () => {
      harness.service.toggleShuffleMode(deviceId);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);

      harness.service.toggleShuffleMode(deviceId);

      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Directory);
    });

    it("does not change another device's launch mode", () => {
      const device2 = 'device-shuffle-2';
      harness.service.initializePlayer(device2);

      harness.service.toggleShuffleMode(deviceId);

      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);
      expect(harness.service.getLaunchMode(device2)()).toBe(LaunchMode.Directory);
    });
  });

  describe('setShuffleScope', () => {
    it('updates the shuffle scope', () => {
      harness.service.setShuffleScope(deviceId, PlayerScope.DirectoryDeep);

      expect(harness.service.getShuffleSettings(deviceId)()?.scope).toBe(PlayerScope.DirectoryDeep);
    });

    it('keeps scope and filter isolated between devices', () => {
      const device2 = 'device-shuffle-2';
      harness.service.initializePlayer(device2);

      harness.service.setShuffleScope(deviceId, PlayerScope.DirectoryDeep);
      harness.service.setFilterMode(deviceId, PlayerFilterType.Music);
      harness.service.setShuffleScope(device2, PlayerScope.Storage);
      harness.service.setFilterMode(device2, PlayerFilterType.Games);

      const settings1 = harness.service.getShuffleSettings(deviceId)();
      const settings2 = harness.service.getShuffleSettings(device2)();

      expect(settings1?.scope).toBe(PlayerScope.DirectoryDeep);
      expect(settings1?.filter).toBe(PlayerFilterType.Music);
      expect(settings2?.scope).toBe(PlayerScope.Storage);
      expect(settings2?.filter).toBe(PlayerFilterType.Games);
    });
  });

  describe('defaults for an uninitialized device', () => {
    it('reports null shuffle settings and Directory launch mode', () => {
      const uninitializedDevice = 'device-shuffle-uninitialized';

      expect(harness.service.getShuffleSettings(uninitializedDevice)()).toBeNull();
      expect(harness.service.getLaunchMode(uninitializedDevice)()).toBe(LaunchMode.Directory);
    });
  });

  describe('shuffle navigation', () => {
    const directoryPath = '/music';
    const testFiles = [
      createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid', parentPath: directoryPath }),
      createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid', parentPath: directoryPath }),
      createTestFileItem({ name: 'song3.sid', path: '/music/song3.sid', parentPath: directoryPath }),
    ];

    beforeEach(async () => {
      await harness.arrangeDirectory({ deviceId, path: directoryPath, files: testFiles });
      await harness.service.launchFileWithContext({
        deviceId,
        file: testFiles[0],
        directoryPath,
        files: testFiles,
        launchMode: LaunchMode.Directory,
      });

      // Directory launch above recorded a history entry that would otherwise make previous()
      // take the history-navigation branch instead of the shuffle random-launch branch under test.
      harness.service.clearHistory(deviceId);
      harness.service.toggleShuffleMode(deviceId);
    });

    it('launches a random file for next()', async () => {
      const randomFile = createTestFileItem({ name: 'random.sid', path: '/random/random.sid' });
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.next(deviceId);

      expect(harness.playerService.launchRandom).toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(randomFile);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);
    });

    it('launches a random file for previous()', async () => {
      const randomFile = createTestFileItem({ name: 'random2.sid', path: '/random/random2.sid' });
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.previous(deviceId);

      expect(harness.playerService.launchRandom).toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(randomFile);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);
    });

    it('aligns to and loads the containing directory as file context on next()', async () => {
      const randomDirectory = '/random';
      const directoryFiles = [
        createTestFileItem({ name: 'a.sid', path: '/random/a.sid', parentPath: randomDirectory }),
        createTestFileItem({ name: 'random.sid', path: '/random/random.sid', parentPath: randomDirectory }),
        createTestFileItem({ name: 'b.sid', path: '/random/b.sid', parentPath: randomDirectory }),
      ];
      const randomFile = directoryFiles[1];
      await harness.arrangeDirectory({ deviceId, path: randomDirectory, files: directoryFiles });
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.next(deviceId);

      const fileContext = harness.service.getFileContext(deviceId)();
      expect(fileContext?.files.map((file) => file.path)).toEqual(
        directoryFiles.map((file) => file.path)
      );
      expect(fileContext?.currentIndex).toBe(1);
    });

    it('aligns to and loads the containing directory as file context on previous()', async () => {
      const randomDirectory = '/sounds';
      const directoryFiles = [
        createTestFileItem({ name: 'track1.sid', path: '/sounds/track1.sid', parentPath: randomDirectory }),
        createTestFileItem({ name: 'track3.sid', path: '/sounds/track3.sid', parentPath: randomDirectory }),
      ];
      const randomFile = directoryFiles[1];
      await harness.arrangeDirectory({ deviceId, path: randomDirectory, files: directoryFiles });
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.previous(deviceId);

      const fileContext = harness.service.getFileContext(deviceId)();
      expect(fileContext?.files.map((file) => file.path)).toEqual(
        directoryFiles.map((file) => file.path)
      );
      expect(fileContext?.currentIndex).toBe(1);
    });

    it('does not block the launch or set an error when directory alignment fails', async () => {
      const randomFile = createTestFileItem({ name: 'random.sid', path: '/broken/random.sid' });
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));
      vi.spyOn(harness.storageStore, 'alignToPlayingFile').mockRejectedValue(
        new Error('Directory load failed')
      );

      await harness.service.next(deviceId);

      expect(harness.playerService.launchRandom).toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(randomFile);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });
  });
});
