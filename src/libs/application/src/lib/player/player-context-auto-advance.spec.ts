import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { LaunchMode, PlayerStatus } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - auto-advance', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-auto-advance';

  // handleIncompatibleFile schedules its routing via setTimeout at
  // PLAYER_INCOMPATIBLE_RETRY_DELAY_MS, which the harness pins to 0. Draining one macrotask is
  // enough for the retry (and everything it awaits internally) to settle.
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    harness = createPlayerHarness();
    harness.service.initializePlayer(deviceId);
  });

  describe('shuffle mode routing', () => {
    it('retries via launchRandomFile until a compatible file lands as current', async () => {
      const incompatibleFile = createTestFileItem({
        name: 'bad.hex',
        path: '/games/bad.hex',
        isCompatible: false,
      });
      const compatibleFile = createTestFileItem({
        name: 'good.sid',
        path: '/music/good.sid',
        isCompatible: true,
      });
      harness.playerService.launchRandom = vi.fn(() => of(compatibleFile));

      await harness.service.launchFileWithContext({
        deviceId,
        file: incompatibleFile,
        directoryPath: '/games',
        files: [incompatibleFile],
        launchMode: LaunchMode.Shuffle,
      });

      // The incompatible file completes the launch cycle normally before the retry fires.
      expect(harness.service.getStatus(deviceId)()).toBe(PlayerStatus.Playing);
      expect(harness.service.getCurrentFile(deviceId)()?.isCompatible).toBe(false);
      expect(harness.service.getError(deviceId)()).toBeNull();

      await flush();

      expect(harness.playerService.launchRandom).toHaveBeenCalledTimes(1);
      const currentFile = harness.service.getCurrentFile(deviceId)();
      expect(currentFile?.file).toEqual(compatibleFile);
      expect(currentFile?.isCompatible).toBe(true);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);
    });
  });

  describe('directory mode routing', () => {
    const directoryPath = '/games';

    it('advances to the next compatible file, skipping consecutive incompatible ones', async () => {
      const first = createTestFileItem({ name: 'good1.prg', path: '/games/good1.prg' });
      const launched = createTestFileItem({
        name: 'bad1.hex',
        path: '/games/bad1.hex',
        isCompatible: false,
      });
      const skipped = createTestFileItem({
        name: 'bad2.hex',
        path: '/games/bad2.hex',
        isCompatible: false,
      });
      const target = createTestFileItem({ name: 'good2.prg', path: '/games/good2.prg' });
      const files = [first, launched, skipped, target];

      await harness.service.launchFileWithContext({
        deviceId,
        file: launched,
        directoryPath,
        files,
        launchMode: LaunchMode.Directory,
      });

      // Populates file context and completes the launch cycle before the scan runs.
      const fileContext = harness.service.getFileContext(deviceId)();
      expect(fileContext?.files).toEqual(files);
      expect(fileContext?.currentIndex).toBe(1);

      await flush();

      expect(harness.playerService.launchFile).toHaveBeenCalledTimes(2);
      expect(harness.playerService.launchFile).toHaveBeenLastCalledWith(deviceId, target);
      const currentFile = harness.service.getCurrentFile(deviceId)();
      expect(currentFile?.file).toEqual(target);
      expect(currentFile?.isCompatible).toBe(true);
    });

    it('wraps around to the beginning when the incompatible file is last', async () => {
      const first = createTestFileItem({ name: 'good.prg', path: '/games/good.prg' });
      const launched = createTestFileItem({
        name: 'bad.hex',
        path: '/games/bad.hex',
        isCompatible: false,
      });
      const files = [first, launched];

      await harness.service.launchFileWithContext({
        deviceId,
        file: launched,
        directoryPath,
        files,
        launchMode: LaunchMode.Directory,
      });
      await flush();

      const currentFile = harness.service.getCurrentFile(deviceId)();
      expect(currentFile?.file).toEqual(first);
      expect(currentFile?.isCompatible).toBe(true);
    });

    it('warns and falls back to a random launch when every file in the directory is incompatible', async () => {
      const first = createTestFileItem({
        name: 'bad1.hex',
        path: '/games/bad1.hex',
        isCompatible: false,
      });
      const second = createTestFileItem({
        name: 'bad2.hex',
        path: '/games/bad2.hex',
        isCompatible: false,
      });
      const third = createTestFileItem({
        name: 'bad3.hex',
        path: '/games/bad3.hex',
        isCompatible: false,
      });
      const files = [first, second, third];
      const randomFallback = createTestFileItem({
        name: 'random.sid',
        path: '/music/random.sid',
        isCompatible: true,
      });
      harness.playerService.launchRandom = vi.fn(() => of(randomFallback));

      await harness.service.launchFileWithContext({
        deviceId,
        file: first,
        directoryPath,
        files,
        launchMode: LaunchMode.Directory,
      });
      await flush();

      expect(harness.alertService.warning).toHaveBeenCalledWith(
        'All files in directory are incompatible'
      );
      expect(harness.playerService.launchRandom).toHaveBeenCalledTimes(1);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(randomFallback);
    });

    it('falls back immediately for a single-file directory without scanning', async () => {
      const onlyFile = createTestFileItem({
        name: 'bad.hex',
        path: '/games/bad.hex',
        isCompatible: false,
      });
      const randomFallback = createTestFileItem({
        name: 'random.sid',
        path: '/music/random.sid',
        isCompatible: true,
      });
      harness.playerService.launchRandom = vi.fn(() => of(randomFallback));

      await harness.service.launchFileWithContext({
        deviceId,
        file: onlyFile,
        directoryPath,
        files: [onlyFile],
        launchMode: LaunchMode.Directory,
      });
      await flush();

      // A single-file directory yields zero forward-scan attempts, so the only launchFile
      // call is the original one - the fallback goes straight to random.
      expect(harness.playerService.launchFile).toHaveBeenCalledTimes(1);
      expect(harness.alertService.warning).toHaveBeenCalledWith(
        'All files in directory are incompatible'
      );
      expect(harness.playerService.launchRandom).toHaveBeenCalledTimes(1);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(randomFallback);
    });
  });

  describe('search mode routing', () => {
    it('advances via the same wrap-around scan as directory mode, preserving Search as the launch mode', async () => {
      const launched = createTestFileItem({
        name: 'bad.hex',
        path: '/search-results/bad.hex',
        isCompatible: false,
      });
      const target = createTestFileItem({
        name: 'good.prg',
        path: '/search-results/good.prg',
      });
      const files = [launched, target];

      await harness.service.launchFileWithContext({
        deviceId,
        file: launched,
        directoryPath: '/search-results',
        files,
        launchMode: LaunchMode.Search,
      });

      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Search);

      await flush();

      const currentFile = harness.service.getCurrentFile(deviceId)();
      expect(currentFile?.file).toEqual(target);
      expect(currentFile?.isCompatible).toBe(true);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Search);
    });
  });

  describe('compatible files', () => {
    it('never triggers advancement', async () => {
      const compatibleFile = createTestFileItem({ name: 'good.prg', path: '/games/good.prg' });

      await harness.service.launchFileWithContext({
        deviceId,
        file: compatibleFile,
        directoryPath: '/games',
        files: [compatibleFile],
        launchMode: LaunchMode.Directory,
      });
      await flush();

      expect(harness.playerService.launchFile).toHaveBeenCalledTimes(1);
      expect(harness.playerService.launchRandom).not.toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(compatibleFile);
    });
  });
});
