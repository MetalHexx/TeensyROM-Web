import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { LaunchMode, StorageType } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - compatibility marking', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-compat';

  // handleIncompatibleFile marks synchronously; only the routing it schedules afterward
  // (the shuffle/directory retry) needs a macrotask to settle.
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const markedFilesFor = (targetDeviceId: string) =>
    harness.storageStore.getSelectedDirectoryState(targetDeviceId)()?.directory?.files;

  beforeEach(() => {
    harness = createPlayerHarness();
    harness.service.initializePlayer(deviceId);
  });

  describe('directory launch', () => {
    const directoryPath = '/games';

    it('marks the incompatible file exactly once, leaving the compatible sibling untouched', async () => {
      const incompatibleFile = createTestFileItem({
        name: 'bad.hex',
        path: '/games/bad.hex',
        isCompatible: false,
      });
      const compatibleSibling = createTestFileItem({ name: 'good.prg', path: '/games/good.prg' });
      const files = [incompatibleFile, compatibleSibling];
      await harness.arrangeDirectory({ deviceId, path: directoryPath, files });
      const updateSpy = vi.spyOn(harness.storageStore, 'updateFileCompatibility');

      await harness.service.launchFileWithContext({
        deviceId,
        file: incompatibleFile,
        directoryPath,
        files,
        launchMode: LaunchMode.Directory,
      });
      await flush();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith({
        deviceId,
        storageType: StorageType.Sd,
        filePath: incompatibleFile.path,
        isCompatible: false,
      });

      const marked = markedFilesFor(deviceId);
      expect(marked?.find((file) => file.path === incompatibleFile.path)?.isCompatible).toBe(
        false
      );
      expect(marked?.find((file) => file.path === compatibleSibling.path)?.isCompatible).not.toBe(
        false
      );
    });

    it('does not mark a compatible file', async () => {
      const compatibleFile = createTestFileItem({ name: 'good.prg', path: '/games/good.prg' });
      await harness.arrangeDirectory({ deviceId, path: directoryPath, files: [compatibleFile] });
      const updateSpy = vi.spyOn(harness.storageStore, 'updateFileCompatibility');

      await harness.service.launchFileWithContext({
        deviceId,
        file: compatibleFile,
        directoryPath,
        files: [compatibleFile],
        launchMode: LaunchMode.Directory,
      });
      await flush();

      expect(updateSpy).not.toHaveBeenCalled();
      expect(markedFilesFor(deviceId)?.[0]?.isCompatible).not.toBe(false);
    });

    it('does not mark a file with undefined isCompatible, and treats it as compatible', async () => {
      const untestedFile = createTestFileItem({
        name: 'untested.sid',
        path: '/games/untested.sid',
        isCompatible: undefined,
      });
      await harness.arrangeDirectory({ deviceId, path: directoryPath, files: [untestedFile] });
      const updateSpy = vi.spyOn(harness.storageStore, 'updateFileCompatibility');

      await harness.service.launchFileWithContext({
        deviceId,
        file: untestedFile,
        directoryPath,
        files: [untestedFile],
        launchMode: LaunchMode.Directory,
      });
      await flush();

      expect(updateSpy).not.toHaveBeenCalled();
      // Treated as compatible: no advancement retry, so the launch call count stays at one.
      expect(harness.playerService.launchFile).toHaveBeenCalledTimes(1);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(untestedFile);
    });
  });

  describe('random launch', () => {
    const parentPath = '/music';

    it('marks the incompatible file exactly once and the storage store reflects it', async () => {
      const incompatibleFile = createTestFileItem({
        name: 'bad.sid',
        path: '/music/bad.sid',
        parentPath,
        isCompatible: false,
      });
      const compatibleFollowup = createTestFileItem({
        name: 'good.sid',
        path: '/music/good.sid',
        parentPath,
        isCompatible: true,
      });
      await harness.arrangeDirectory({ deviceId, path: parentPath, files: [incompatibleFile] });
      const updateSpy = vi.spyOn(harness.storageStore, 'updateFileCompatibility');
      // Only the first call is incompatible - the shuffle retry this detection schedules must
      // land on a compatible file, or its own detection would add a second, legitimate mark
      // and make "exactly once" unobservable.
      harness.playerService.launchRandom = vi
        .fn()
        .mockReturnValueOnce(of(incompatibleFile))
        .mockReturnValue(of(compatibleFollowup));

      await harness.service.launchRandomFile(deviceId);
      await flush();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith({
        deviceId,
        storageType: StorageType.Sd,
        filePath: incompatibleFile.path,
        isCompatible: false,
      });
      expect(
        markedFilesFor(deviceId)?.find((file) => file.path === incompatibleFile.path)
          ?.isCompatible
      ).toBe(false);
    });

    it('does not mark a compatible random launch', async () => {
      const compatibleFile = createTestFileItem({
        name: 'good.sid',
        path: '/music/good.sid',
        parentPath,
        isCompatible: true,
      });
      await harness.arrangeDirectory({ deviceId, path: parentPath, files: [compatibleFile] });
      const updateSpy = vi.spyOn(harness.storageStore, 'updateFileCompatibility');
      harness.playerService.launchRandom = vi.fn(() => of(compatibleFile));

      await harness.service.launchRandomFile(deviceId);
      await flush();

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('each of two sequential incompatible launches marks only its own file', async () => {
      const bad1 = createTestFileItem({
        name: 'bad1.sid',
        path: '/music/bad1.sid',
        parentPath,
        isCompatible: false,
      });
      const bad2 = createTestFileItem({
        name: 'bad2.sid',
        path: '/music/bad2.sid',
        parentPath,
        isCompatible: false,
      });
      const compatibleFollowup = createTestFileItem({
        name: 'good.sid',
        path: '/music/good.sid',
        parentPath,
        isCompatible: true,
      });
      await harness.arrangeDirectory({
        deviceId,
        path: parentPath,
        files: [bad1, bad2, compatibleFollowup],
      });
      const updateSpy = vi.spyOn(harness.storageStore, 'updateFileCompatibility');

      harness.playerService.launchRandom = vi
        .fn()
        .mockReturnValueOnce(of(bad1))
        .mockReturnValue(of(compatibleFollowup));
      await harness.service.launchRandomFile(deviceId);
      await flush();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ filePath: bad1.path, isCompatible: false })
      );

      harness.playerService.launchRandom = vi
        .fn()
        .mockReturnValueOnce(of(bad2))
        .mockReturnValue(of(compatibleFollowup));
      await harness.service.launchRandomFile(deviceId);
      await flush();

      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(updateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ filePath: bad2.path, isCompatible: false })
      );
    });
  });
});
