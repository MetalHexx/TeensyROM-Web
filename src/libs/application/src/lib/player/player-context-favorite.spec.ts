import { describe, it, expect, beforeEach } from 'vitest';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - favorite status', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-favorite';

  beforeEach(() => {
    harness = createPlayerHarness();
    harness.service.initializePlayer(deviceId);
  });

  it('marks the current file favorite and updates its matching entry in file context', async () => {
    const file = createTestFileItem({ path: '/music/song1.sid' });
    const sibling = createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' });
    await harness.service.launchFileWithContext({
      deviceId,
      file,
      directoryPath: '/music',
      files: [file, sibling],
    });

    harness.service.updateCurrentFileFavoriteStatus(deviceId, file.path, true);

    expect(harness.service.getCurrentFile(deviceId)()?.file.isFavorite).toBe(true);
    const fileContext = harness.service.getFileContext(deviceId)();
    expect(fileContext?.files.find((f) => f.path === file.path)?.isFavorite).toBe(true);
    expect(fileContext?.files.find((f) => f.path === sibling.path)?.isFavorite).toBe(false);
  });

  it('updates every context entry that shares the favorited path', async () => {
    const file = createTestFileItem({ path: '/music/duplicate.sid' });
    const duplicateA = { ...file, name: 'duplicate-a.sid' };
    const duplicateB = { ...file, name: 'duplicate-b.sid' };
    await harness.service.launchFileWithContext({
      deviceId,
      file: duplicateA,
      directoryPath: '/music',
      files: [duplicateA, duplicateB],
    });

    harness.service.updateCurrentFileFavoriteStatus(deviceId, file.path, true);

    const matches = harness.service
      .getFileContext(deviceId)()
      ?.files.filter((f) => f.path === file.path);
    expect(matches).toHaveLength(2);
    matches?.forEach((entry) => expect(entry.isFavorite).toBe(true));
  });

  it('leaves state untouched when the given path is not loaded, and toggles back off cleanly', async () => {
    const file = createTestFileItem({ path: '/music/original.sid' });
    await harness.service.launchFileWithContext({
      deviceId,
      file,
      directoryPath: '/music',
      files: [file],
    });

    harness.service.updateCurrentFileFavoriteStatus(deviceId, '/music/missing.sid', true);
    expect(harness.service.getCurrentFile(deviceId)()?.file.isFavorite).toBe(false);

    harness.service.updateCurrentFileFavoriteStatus(deviceId, file.path, true);
    harness.service.updateCurrentFileFavoriteStatus(deviceId, file.path, false);
    expect(harness.service.getCurrentFile(deviceId)()?.file.isFavorite).toBe(false);
    expect(harness.service.getFileContext(deviceId)()?.files[0].isFavorite).toBe(false);
  });

  it('is a safe no-op for an unknown device or before any file has launched', () => {
    expect(() =>
      harness.service.updateCurrentFileFavoriteStatus('unknown-device', '/music/song.sid', true)
    ).not.toThrow();

    harness.service.updateCurrentFileFavoriteStatus(deviceId, '/music/song.sid', true);
    expect(harness.service.getCurrentFile(deviceId)()).toBeNull();
    expect(harness.service.getFileContext(deviceId)()).toBeNull();
  });

  it('isolates favorite updates per device', async () => {
    const otherDeviceId = 'device-favorite-secondary';
    const primaryFile = createTestFileItem({ path: '/music/primary.sid' });
    const secondaryFile = createTestFileItem({ path: '/music/secondary.sid' });

    await harness.service.launchFileWithContext({
      deviceId,
      file: primaryFile,
      directoryPath: '/music',
      files: [primaryFile],
    });
    harness.service.initializePlayer(otherDeviceId);
    await harness.service.launchFileWithContext({
      deviceId: otherDeviceId,
      file: secondaryFile,
      directoryPath: '/music',
      files: [secondaryFile],
    });

    harness.service.updateCurrentFileFavoriteStatus(deviceId, primaryFile.path, true);

    expect(harness.service.getCurrentFile(deviceId)()?.file.isFavorite).toBe(true);
    expect(harness.service.getCurrentFile(otherDeviceId)()?.file.isFavorite).toBe(false);
  });
});
