import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { FileItem, FileItemType, LaunchMode, StorageType } from '@teensyrom-nx/domain';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { createPlayerHarness } from './player-context-harness';

describe('createPlayerHarness', () => {
  const deviceId = 'device-1';
  const directoryPath = '/games';

  const createDirectoryFiles = (): FileItem[] => [
    createTestFileItem({
      name: 'first.crt',
      path: `${directoryPath}/first.crt`,
      parentPath: directoryPath,
      type: FileItemType.Game,
    }),
    createTestFileItem({
      name: 'second.crt',
      path: `${directoryPath}/second.crt`,
      parentPath: directoryPath,
      type: FileItemType.Game,
    }),
  ];

  it('arranges a directory through the real StorageStore', async () => {
    const harness = createPlayerHarness();
    const files = createDirectoryFiles();

    await harness.arrangeDirectory({ deviceId, path: directoryPath, files });

    const directoryState = harness.storageStore.getSelectedDirectoryState(deviceId)();
    expect(directoryState?.currentPath).toBe(directoryPath);
    expect(directoryState?.storageType).toBe(StorageType.Sd);
    expect(directoryState?.directory?.files.map((file) => file.path)).toEqual(
      files.map((file) => file.path)
    );
  });

  it('launches a file into the real PlayerStore', async () => {
    const harness = createPlayerHarness();
    const files = createDirectoryFiles();
    await harness.arrangeDirectory({ deviceId, path: directoryPath, files });

    harness.service.initializePlayer(deviceId);
    await harness.service.launchFileWithContext({
      deviceId,
      file: files[1],
      directoryPath,
      files,
      launchMode: LaunchMode.Directory,
    });

    expect(harness.service.getCurrentFile(deviceId)()?.file.path).toBe(files[1].path);
    expect(harness.playerStore.getPlayerFileContext(deviceId)()?.currentIndex).toBe(1);
    expect(harness.playerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
  });

  it('round-trips a random launch through both real stores', async () => {
    const files = createDirectoryFiles();
    const harness = createPlayerHarness({
      services: { player: { launchRandom: vi.fn(() => of(files[1])) } },
    });
    await harness.arrangeDirectory({ deviceId, path: directoryPath, files });

    harness.service.initializePlayer(deviceId);
    await harness.service.launchRandomFile(deviceId);

    expect(harness.service.getCurrentFile(deviceId)()?.file.path).toBe(files[1].path);

    // The file context is rebuilt from what the real StorageStore holds for the directory,
    // so a populated context proves both stores took part in the launch.
    const fileContext = harness.service.getFileContext(deviceId)();
    expect(fileContext?.directoryPath).toBe(directoryPath);
    expect(fileContext?.files.map((file) => file.path)).toEqual(files.map((file) => file.path));
    expect(fileContext?.currentIndex).toBe(1);
    expect(harness.storageStore.getSelectedDirectoryState(deviceId)()?.currentPath).toBe(
      directoryPath
    );
  });
});
