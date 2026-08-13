import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { LaunchMode, StorageType } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - URL and popstate', () => {
  let harness: PlayerHarness;
  let location: Location;
  const deviceId = 'device-url';

  // handlePopState is invoked fire-and-forget from the popstate listener, so its completion
  // can only be observed by draining the macrotask queue rather than awaiting a return value.
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    harness = createPlayerHarness();
    location = TestBed.inject(Location);
    harness.service.initializePlayer(deviceId);
  });

  afterEach(() => {
    harness.service.stopListeningToPopState();
  });

  describe('updateUrlForLaunchedFile', () => {
    it('updates the URL with device, storage, path, and file after a directory launch', async () => {
      const file = createTestFileItem({
        name: 'song.sid',
        path: '/music/song.sid',
        parentPath: '/music',
      });

      await harness.service.launchFileWithContext({
        deviceId,
        file,
        directoryPath: '/music',
        files: [file],
      });

      const path = location.path();
      expect(path).toContain(`device=${deviceId}`);
      expect(path).toContain('storage=SD');
      expect(path).toContain('path=/music');
      expect(path).toContain('file=song.sid');
    });

    it('updates the URL after a random launch', async () => {
      const randomFile = createTestFileItem({
        name: 'random.sid',
        path: '/games/random.sid',
        parentPath: '/games',
      });
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.launchRandomFile(deviceId);

      expect(location.path()).toContain('file=random.sid');
    });

    it('updates the URL after next() advances to a new file', async () => {
      const directoryPath = '/music';
      const files = [
        createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid', parentPath: directoryPath }),
        createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid', parentPath: directoryPath }),
      ];
      await harness.arrangeDirectory({ deviceId, path: directoryPath, files });
      await harness.service.launchFileWithContext({
        deviceId,
        file: files[0],
        directoryPath,
        files,
        launchMode: LaunchMode.Directory,
      });

      await harness.service.next(deviceId);

      expect(location.path()).toContain('file=song2.sid');
    });
  });

  describe('startListeningToPopState / stopListeningToPopState', () => {
    it('registers a window popstate listener', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      harness.service.startListeningToPopState();

      expect(addSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    it('removes the exact listener it registered', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      harness.service.startListeningToPopState();
      const registeredCall = addSpy.mock.calls.find(([type]) => type === 'popstate');
      expect(registeredCall).toBeDefined();

      harness.service.stopListeningToPopState();

      expect(removeSpy).toHaveBeenCalledWith('popstate', registeredCall?.[1]);
    });

    it('is a safe no-op to stop listening when never started', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      expect(() => harness.service.stopListeningToPopState()).not.toThrow();

      expect(removeSpy).not.toHaveBeenCalled();
    });

    it('does not register a second listener when already listening', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      harness.service.startListeningToPopState();
      harness.service.startListeningToPopState();

      expect(addSpy.mock.calls.filter(([type]) => type === 'popstate')).toHaveLength(1);
    });

    it('no longer reacts to popstate events once stopped', async () => {
      harness.service.startListeningToPopState();
      harness.service.stopListeningToPopState();
      const navigateSpy = vi.spyOn(harness.storageStore, 'navigateToDirectory');

      window.history.pushState(null, '', `/player?device=${deviceId}&storage=SD&path=/music&file=song.sid`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      await flush();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('browser back/forward navigation', () => {
    const directoryPath = '/music';
    const files = [
      createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid', parentPath: directoryPath }),
      createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid', parentPath: directoryPath }),
    ];

    beforeEach(async () => {
      await harness.arrangeDirectory({ deviceId, path: directoryPath, files });
      harness.service.startListeningToPopState();
    });

    it('relaunches the file identified by the URL query parameters', async () => {
      window.history.pushState(
        null,
        '',
        `/player?device=${deviceId}&storage=SD&path=${directoryPath}&file=${files[1].name}`
      );

      window.dispatchEvent(new PopStateEvent('popstate'));
      await flush();

      expect(harness.service.getCurrentFile(deviceId)()?.file.path).toBe(files[1].path);
    });

    it('navigates the storage directory even without a file parameter', async () => {
      const navigateSpy = vi.spyOn(harness.storageStore, 'navigateToDirectory');

      window.history.pushState(null, '', `/player?device=${deviceId}&storage=SD&path=${directoryPath}`);

      window.dispatchEvent(new PopStateEvent('popstate'));
      await flush();

      expect(navigateSpy).toHaveBeenCalledWith({
        deviceId,
        storageType: StorageType.Sd,
        path: directoryPath,
      });
    });

    it('ignores popstate events missing deep-linking parameters', async () => {
      const navigateSpy = vi.spyOn(harness.storageStore, 'navigateToDirectory');

      window.history.pushState(null, '', '/player');

      window.dispatchEvent(new PopStateEvent('popstate'));
      await flush();

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('warns and does not relaunch when the named file is not in the directory', async () => {
      window.history.pushState(
        null,
        '',
        `/player?device=${deviceId}&storage=SD&path=${directoryPath}&file=missing.sid`
      );

      window.dispatchEvent(new PopStateEvent('popstate'));
      await flush();

      expect(harness.alertService.warning).toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()).toBeNull();
    });
  });
});
