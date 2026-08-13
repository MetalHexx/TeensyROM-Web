import { describe, it, expect, beforeEach, vi } from 'vitest';
import { throwError } from 'rxjs';
import { LaunchMode, PlayerStatus, FileItemType } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - playback controls', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-playback';

  beforeEach(() => {
    harness = createPlayerHarness();
    harness.service.initializePlayer(deviceId);
  });

  describe('play', () => {
    const musicFile = createTestFileItem({ type: FileItemType.Song });

    it('invokes toggleMusic and transitions to Playing when stopped', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });
      await harness.service.stop(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);

      await harness.service.play(deviceId);

      expect(harness.playerService.toggleMusic).toHaveBeenCalledWith(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it('resumes to Playing when paused', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });
      await harness.service.pause(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Paused);

      await harness.service.play(deviceId);

      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it('is a no-op when already playing', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
      vi.mocked(harness.playerService.toggleMusic!).mockClear();

      await harness.service.play(deviceId);

      expect(harness.playerService.toggleMusic).not.toHaveBeenCalled();
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it('sets error state when the play API call fails', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });
      await harness.service.stop(deviceId);
      harness.playerService.toggleMusic = vi.fn(() => throwError(() => new Error('Play failed')));

      await harness.service.play(deviceId);

      expect(harness.service.getError(deviceId)()).toBeTruthy();
    });
  });

  describe('pause', () => {
    const musicFile = createTestFileItem({ type: FileItemType.Song });

    beforeEach(async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('invokes toggleMusic and transitions to Paused when playing', async () => {
      await harness.service.pause(deviceId);

      expect(harness.playerService.toggleMusic).toHaveBeenCalledWith(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Paused);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it('is a no-op when already paused', async () => {
      await harness.service.pause(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Paused);
      vi.mocked(harness.playerService.toggleMusic!).mockClear();

      await harness.service.pause(deviceId);

      expect(harness.playerService.toggleMusic).not.toHaveBeenCalled();
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Paused);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it('is a no-op when stopped', async () => {
      await harness.service.stop(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);
      vi.mocked(harness.playerService.toggleMusic!).mockClear();

      await harness.service.pause(deviceId);

      expect(harness.playerService.toggleMusic).not.toHaveBeenCalled();
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it('sets error state when the pause API call fails', async () => {
      harness.playerService.toggleMusic = vi.fn(() => throwError(() => new Error('Pause failed')));

      await harness.service.pause(deviceId);

      expect(harness.service.getError(deviceId)()).toBeTruthy();
    });
  });

  describe('stop', () => {
    it('resets the device and clears error', async () => {
      await harness.service.stop(deviceId);

      expect(harness.deviceService.resetDevice).toHaveBeenCalledWith(deviceId);
      expect(harness.service.getError(deviceId)()).toBeNull();
    });

    it('sets error state when the device reset fails', async () => {
      harness.deviceService.resetDevice = vi.fn(() =>
        throwError(() => new Error('Device reset failed'))
      );

      await harness.service.stop(deviceId);

      expect(harness.service.getError(deviceId)()).toBeTruthy();
    });
  });

  describe('next and previous - directory navigation', () => {
    const files = [
      createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid' }),
      createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' }),
      createTestFileItem({ name: 'game.prg', path: '/music/game.prg', type: FileItemType.Game }),
    ];
    const [file1, file2, file3] = files;

    beforeEach(async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: file1,
        directoryPath: '/music',
        files,
        launchMode: LaunchMode.Directory,
      });
    });

    it('navigates to the next file in the directory', async () => {
      await harness.service.next(deviceId);

      expect(harness.playerService.launchFile).toHaveBeenCalledWith(deviceId, file2);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(file2);
    });

    it('navigates to the previous file in the directory', async () => {
      await harness.service.next(deviceId);
      await harness.service.previous(deviceId);

      expect(harness.playerService.launchFile).toHaveBeenLastCalledWith(deviceId, file1);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(file1);
    });

    it('wraps to the last file when navigating previous from the first file', async () => {
      await harness.service.previous(deviceId);

      expect(harness.playerService.launchFile).toHaveBeenCalledWith(deviceId, file3);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(file3);
    });

    it('wraps to the first file when navigating next from the last file', async () => {
      await harness.service.next(deviceId);
      await harness.service.next(deviceId); // now at file3, the last file

      await harness.service.next(deviceId);

      expect(harness.playerService.launchFile).toHaveBeenLastCalledWith(deviceId, file1);
    });
  });

  describe('navigation error handling', () => {
    const files = [
      createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid' }),
      createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' }),
    ];

    beforeEach(async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: files[0],
        directoryPath: '/music',
        files,
        launchMode: LaunchMode.Directory,
      });
    });

    it('sets error state when next() navigation fails', async () => {
      harness.playerService.launchFile = vi.fn(() =>
        throwError(() => new Error('Next navigation failed'))
      );

      await harness.service.next(deviceId);

      expect(harness.service.getError(deviceId)()).toBeTruthy();
    });

    it('sets error state when previous() navigation fails', async () => {
      harness.playerService.launchFile = vi.fn(() =>
        throwError(() => new Error('Previous navigation failed'))
      );

      await harness.service.previous(deviceId);

      expect(harness.service.getError(deviceId)()).toBeTruthy();
    });

    it('resolves without throwing when navigating a device with no file context', async () => {
      harness.service.removePlayer(deviceId);
      harness.service.initializePlayer(deviceId);

      await expect(harness.service.next(deviceId)).resolves.not.toThrow();
      await expect(harness.service.previous(deviceId)).resolves.not.toThrow();
    });
  });

  describe('status transitions', () => {
    it('transitions from Stopped to Playing when launching a music file', async () => {
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);

      await harness.service.launchFileWithContext({
        deviceId,
        file: createTestFileItem({ type: FileItemType.Song }),
        directoryPath: '/music',
        files: [createTestFileItem()],
      });

      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('transitions to Playing when launching a non-music file', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: createTestFileItem({ type: FileItemType.Game }),
        directoryPath: '/games',
        files: [createTestFileItem({ type: FileItemType.Game })],
      });

      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('round-trips Playing -> Paused -> Playing when toggling playback', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: createTestFileItem({ type: FileItemType.Song }),
        directoryPath: '/music',
        files: [createTestFileItem()],
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);

      await harness.service.pause(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Paused);

      await harness.service.play(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('resumes to Playing when play() is called from Stopped', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: createTestFileItem({ type: FileItemType.Song }),
        directoryPath: '/music',
        files: [createTestFileItem()],
      });

      await harness.service.stop(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);

      await harness.service.play(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('transitions Playing to Stopped when stop() is called', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: createTestFileItem({ type: FileItemType.Song }),
        directoryPath: '/music',
        files: [createTestFileItem()],
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);

      await harness.service.stop(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);
    });

    it('stays Stopped when stop() is called on an already-stopped player', async () => {
      await harness.service.stop(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);

      await harness.service.stop(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);
    });

    it('keeps status Playing when navigating next from Playing', async () => {
      const files = [
        createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid' }),
        createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' }),
      ];
      await harness.service.launchFileWithContext({
        deviceId,
        file: files[0],
        directoryPath: '/music',
        files,
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);

      await harness.service.next(deviceId);

      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('keeps status Playing when navigating previous from Playing', async () => {
      const files = [
        createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid' }),
        createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' }),
      ];
      await harness.service.launchFileWithContext({
        deviceId,
        file: files[0],
        directoryPath: '/music',
        files,
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);

      await harness.service.previous(deviceId);

      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('resumes to Playing when navigating from a stopped state', async () => {
      const files = [
        createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid' }),
        createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' }),
      ];
      await harness.service.launchFileWithContext({
        deviceId,
        file: files[0],
        directoryPath: '/music',
        files,
      });

      await harness.service.stop(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);

      await harness.service.next(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('produces the expected status at each step of a launch -> pause -> play -> stop -> previous sequence', async () => {
      const musicFile = createTestFileItem({ type: FileItemType.Song });
      const files = [musicFile, createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' })];

      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files,
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);

      await harness.service.pause(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Paused);

      await harness.service.play(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);

      await harness.service.stop(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Stopped);

      await harness.service.previous(deviceId);
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('keeps status Playing when switching from a music file to a game file', async () => {
      const musicFile = createTestFileItem({ type: FileItemType.Song });
      const gameFile = createTestFileItem({ type: FileItemType.Game, name: 'game.prg' });

      await harness.service.launchFileWithContext({
        deviceId,
        file: musicFile,
        directoryPath: '/music',
        files: [musicFile],
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);

      await harness.service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile],
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });

    it('leaves status in a valid value and records an error when a pause() API call fails', async () => {
      await harness.service.launchFileWithContext({
        deviceId,
        file: createTestFileItem({ type: FileItemType.Song }),
        directoryPath: '/music',
        files: [createTestFileItem()],
      });
      expect(harness.service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);

      harness.playerService.toggleMusic = vi.fn(() => throwError(() => new Error('API Error')));

      await harness.service.pause(deviceId);

      const status = harness.service.getPlayerStatus(deviceId)();
      expect([PlayerStatus.Playing, PlayerStatus.Paused, PlayerStatus.Stopped]).toContain(status);
      expect(harness.service.getError(deviceId)()).toBeTruthy();
    });
  });
});
