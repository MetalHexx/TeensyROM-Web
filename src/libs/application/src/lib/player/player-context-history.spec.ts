import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { FileItemType, LaunchMode } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - play history', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-history';

  beforeEach(() => {
    // Incompatible-file launches in this file are only exercised for their history-recording
    // effect, not for the auto-advance retry that follows (that's player-context-auto-advance
    // .spec.ts's job) - a long delay keeps that retry from ever firing during a test and
    // leaking a `launchRandomFile` call into the next test's already-destroyed injector.
    harness = createPlayerHarness({ incompatibleRetryDelayMs: 60_000 });
    harness.service.initializePlayer(deviceId);
  });

  const launch = (file: ReturnType<typeof createTestFileItem>, files = [file]) =>
    harness.service.launchFileWithContext({
      deviceId,
      file,
      directoryPath: '/music',
      files,
    });

  // Seeds a Shuffle-mode history: launches one entry per name, in order, then switches the
  // device into Shuffle so the back/forward history-navigation branches of next()/previous()
  // are the ones exercised.
  const seedHistory = async (names: string[]) => {
    const files = names.map((name) => createTestFileItem({ path: `/music/${name}.sid`, name }));
    for (const file of files) {
      harness.playerService.launchFile = vi.fn(() => of(file));
      await launch(file);
    }
    harness.service.toggleShuffleMode(deviceId);
    return files;
  };

  describe('initial state', () => {
    it('has no history, position -1, and cannot navigate in either direction', () => {
      expect(harness.service.getPlayHistory(deviceId)()).toBeNull();
      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(-1);
      expect(harness.service.canNavigateBackwardInHistory(deviceId)()).toBe(false);
      expect(harness.service.canNavigateForwardInHistory(deviceId)()).toBe(false);
    });
  });

  describe('recording on launch', () => {
    it('records an entry on a successful directory launch', async () => {
      const file = createTestFileItem({ path: '/music/song1.sid' });
      await launch(file);

      const history = harness.service.getPlayHistory(deviceId)();
      expect(history?.entries).toHaveLength(1);
      expect(history?.entries[0].file).toEqual(file);
      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(-1);
    });

    it('records an entry on a successful random launch', async () => {
      const file = createTestFileItem({ path: '/music/random.sid' });
      harness.playerService.launchRandom = vi.fn(() => of(file));

      await harness.service.launchRandomFile(deviceId);

      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);
    });

    it('does not record a failed launch, and recovers on the next successful one', async () => {
      const file = createTestFileItem({ path: '/music/song1.sid' });
      harness.playerService.launchFile = vi.fn(() => throwError(() => new Error('failed')));
      await launch(file);
      expect(harness.service.getPlayHistory(deviceId)()).toBeNull();

      harness.playerService.launchFile = vi.fn(() => of(file));
      await launch(file);

      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);
    });

    it('records only compatible launches, in order, leaving untouched entries alone', async () => {
      const compatible1 = createTestFileItem({ path: '/music/c1.sid', name: 'c1.sid' });
      const compatible2 = createTestFileItem({ path: '/music/c2.sid', name: 'c2.sid' });
      const compatible3 = createTestFileItem({ path: '/music/c3.sid', name: 'c3.sid' });
      const incompatible = (path: string) =>
        createTestFileItem({ path, name: path, isCompatible: false });

      await launch(compatible1);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);

      // Three consecutive incompatible launches record nothing.
      await launch(incompatible('/music/i1.hex'));
      await launch(incompatible('/music/i2.hex'));
      await launch(incompatible('/music/i3.hex'));
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);

      await launch(compatible2);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(2);

      await launch(incompatible('/music/i4.hex'));
      expect(harness.service.getPlayHistory(deviceId)()?.entries.map((e) => e.file.name)).toEqual([
        'c1.sid',
        'c2.sid',
      ]);

      await launch(compatible3);
      const finalNames = harness.service
        .getPlayHistory(deviceId)()
        ?.entries.map((e) => e.file.name);
      expect(finalNames).toEqual(['c1.sid', 'c2.sid', 'c3.sid']);
    });

    it('enforces the 1000-entry cap by evicting the oldest entries', async () => {
      for (let i = 0; i < 1002; i++) {
        const file = createTestFileItem({ path: `/music/song${i}.sid`, name: `song${i}.sid` });
        harness.playerService.launchFile = vi.fn(() => of(file));
        await launch(file);
      }

      const history = harness.service.getPlayHistory(deviceId)();
      expect(history?.entries).toHaveLength(1000);
      expect(history?.entries[0].file.name).toBe('song2.sid');
      expect(history?.entries[999].file.name).toBe('song1001.sid');
    }, 20000);
  });

  describe('recording on navigation', () => {
    const files = [
      createTestFileItem({ path: '/music/song1.sid', name: 'song1.sid' }),
      createTestFileItem({ path: '/music/song2.sid', name: 'song2.sid' }),
      createTestFileItem({ path: '/music/song3.sid', name: 'song3.sid' }),
    ];

    it('records an entry for both next() and previous() while browsing, not history-navigating', async () => {
      await launch(files[0], files);

      await harness.service.next(deviceId);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(2);

      await harness.service.previous(deviceId);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(3);
    });

    it('records history in Shuffle mode too', async () => {
      await launch(files[0], files);
      harness.service.toggleShuffleMode(deviceId);

      await harness.service.next(deviceId);

      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(2);
    });

    it('skips a back-to-back duplicate launch, but records a replay after an intervening file', async () => {
      const file1 = createTestFileItem({ path: '/music/song1.sid' });
      const file2 = createTestFileItem({ path: '/music/song2.sid' });

      harness.playerService.launchFile = vi.fn(() => of(file1));
      await launch(file1);
      await launch(file1);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);

      harness.playerService.launchFile = vi.fn(() => of(file2));
      await launch(file2);
      harness.playerService.launchFile = vi.fn(() => of(file1));
      await launch(file1);

      const names = harness.service
        .getPlayHistory(deviceId)()
        ?.entries.map((e) => e.file.path);
      expect(names).toEqual([file1.path, file2.path, file1.path]);
    });
  });

  describe('entry data integrity', () => {
    it('captures the launched file, path, timestamp, and a storageKey encoding device and storage type', async () => {
      const file = createTestFileItem({ path: '/music/song1.sid', parentPath: '/music' });
      await launch(file);

      const entry = harness.service.getPlayHistory(deviceId)()?.entries[0];
      expect(entry?.file).toEqual(file);
      expect(entry?.parentPath).toBe('/music');
      expect(entry?.isCompatible).toBe(true);
      expect(entry?.timestamp).toBeGreaterThan(0);
      expect(entry?.storageKey).toContain(deviceId);
      expect(entry?.storageKey).toContain('SD');
    });
  });

  describe('clearHistory', () => {
    it('empties existing history and is a safe no-op when already empty', async () => {
      await launch(createTestFileItem());
      harness.service.clearHistory(deviceId);
      expect(harness.service.getPlayHistory(deviceId)()).toBeNull();

      expect(() => harness.service.clearHistory(deviceId)).not.toThrow();
      expect(harness.service.getPlayHistory(deviceId)()).toBeNull();
    });

    it('starts a fresh single-entry history after a launch following clearHistory()', async () => {
      await launch(createTestFileItem({ path: '/music/old.sid' }));
      harness.service.clearHistory(deviceId);

      const newFile = createTestFileItem({ path: '/music/new.sid' });
      await launch(newFile);

      const history = harness.service.getPlayHistory(deviceId)();
      expect(history?.entries).toHaveLength(1);
      expect(history?.entries[0].file).toEqual(newFile);
    });
  });

  describe('timeline integrity', () => {
    it('records only the compatible entries in launch order with strictly ascending timestamps', async () => {
      const names = ['game1', 'game2', 'game3', 'game4', 'game5'];
      for (const [i, name] of names.entries()) {
        const isCompatible = i % 2 === 0;
        const file = createTestFileItem({ path: `/games/${name}.prg`, name, isCompatible });
        harness.playerService.launchFile = vi.fn(() => of(file));
        await launch(file);
      }

      const entries = harness.service.getPlayHistory(deviceId)()?.entries ?? [];
      expect(entries.map((e) => e.file.name)).toEqual(['game1', 'game3', 'game5']);
      const timestamps = entries.map((e) => e.timestamp);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
      expect(new Set(timestamps).size).toBe(timestamps.length);
    });

    it('skips an incompatible entry sitting between two compatible ones and reflects it in the navigation flags', async () => {
      const track1 = createTestFileItem({ path: '/music/track1.sid', name: 'track1' });
      const track2 = createTestFileItem({
        path: '/music/track2.sid',
        name: 'track2',
        isCompatible: false,
      });
      const track3 = createTestFileItem({ path: '/music/track3.sid', name: 'track3' });

      for (const file of [track1, track2, track3]) {
        harness.playerService.launchFile = vi.fn(() => of(file));
        await launch(file);
      }

      const entries = harness.service.getPlayHistory(deviceId)()?.entries ?? [];
      expect(entries.map((e) => e.file.name)).toEqual(['track1', 'track3']);
      expect(harness.service.canNavigateBackwardInHistory(deviceId)()).toBe(true);
      expect(harness.service.canNavigateForwardInHistory(deviceId)()).toBe(false);
    });

    it('excludes an incompatible file from history regardless of Shuffle, Directory, or Search launch mode', async () => {
      const modes = [LaunchMode.Shuffle, LaunchMode.Directory, LaunchMode.Search];
      for (const launchMode of modes) {
        const incompatible = createTestFileItem({ isCompatible: false });
        harness.playerService.launchFile = vi.fn(() => of(incompatible));
        await harness.service.launchFileWithContext({
          deviceId,
          file: incompatible,
          directoryPath: '/music',
          files: [incompatible],
          launchMode,
        });
      }
      expect(harness.service.getPlayHistory(deviceId)()).toBeNull();

      const compatible = createTestFileItem();
      harness.playerService.launchFile = vi.fn(() => of(compatible));
      await launch(compatible);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);
    });
  });

  describe('device lifecycle', () => {
    it('clears history on removal, and starts fresh on the next launch after reinitializing', async () => {
      await launch(createTestFileItem());
      harness.service.removePlayer(deviceId);
      harness.service.initializePlayer(deviceId);
      expect(harness.service.getPlayHistory(deviceId)()).toBeNull();

      const file = createTestFileItem({ path: '/music/fresh.sid' });
      await launch(file);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);
    });

    it('keeps two devices independent, so clearing one leaves the other untouched', async () => {
      const other = 'device-history-other';
      harness.service.initializePlayer(other);
      const file1 = createTestFileItem({ path: '/music/device1.sid' });
      const file2 = createTestFileItem({ path: '/music/device2.sid' });

      await launch(file1);
      harness.playerService.launchFile = vi.fn(() => of(file2));
      await harness.service.launchFileWithContext({
        deviceId: other,
        file: file2,
        directoryPath: '/music',
        files: [file2],
      });

      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);
      expect(harness.service.getPlayHistory(other)()?.entries).toHaveLength(1);

      harness.service.clearHistory(deviceId);

      expect(harness.service.getPlayHistory(deviceId)()).toBeNull();
      expect(harness.service.getPlayHistory(other)()?.entries).toHaveLength(1);
    });
  });

  describe('back/forward navigation', () => {

    it('launches the most recent entry via launchFile (not random), without growing history', async () => {
      const files = await seedHistory(['file1', 'file2', 'file3']);
      harness.playerService.launchFile = vi.fn(() => of(files[2]));
      harness.playerService.launchRandom = vi.fn();

      await harness.service.previous(deviceId);

      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(2);
      expect(harness.playerService.launchFile).toHaveBeenCalledWith(deviceId, files[2]);
      expect(harness.playerService.launchRandom).not.toHaveBeenCalled();
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(3);
    });

    it('wraps from the oldest entry to the newest without adding a new entry', async () => {
      const files = await seedHistory(['file1', 'file2', 'file3']);
      harness.playerService.launchFile = vi.fn((_id, file) => of(file));

      await harness.service.previous(deviceId);
      await harness.service.previous(deviceId);
      await harness.service.previous(deviceId);
      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(0);

      await harness.service.previous(deviceId);

      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(2);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(files[2]);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(3);
    });

    it('falls back to a random launch when history is empty', async () => {
      const randomFile = createTestFileItem({ path: '/music/random.sid' });
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));
      harness.service.toggleShuffleMode(deviceId);

      await harness.service.previous(deviceId);

      expect(harness.playerService.launchRandom).toHaveBeenCalled();
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(randomFile);
    });

    it('uses ordinary file-context navigation in Directory mode for both next() and previous(), unaffected by history position', async () => {
      const files = [
        createTestFileItem({ path: '/music/song1.sid', name: 'song1.sid' }),
        createTestFileItem({ path: '/music/song2.sid', name: 'song2.sid' }),
      ];
      await launch(files[0], files);

      await harness.service.next(deviceId);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(files[1]);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Directory);

      await harness.service.previous(deviceId);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(files[0]);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Directory);
    });

    it("re-aligns and loads the target entry's directory for both backward and forward navigation", async () => {
      const files = await seedHistory(['file1', 'file2', 'file3']);
      await harness.arrangeDirectory({ deviceId, path: '/music', files });
      harness.playerService.launchFile = vi.fn((_id, file) => of(file));
      const alignSpy = vi.spyOn(harness.storageStore, 'alignToPlayingFile');

      await harness.service.previous(deviceId);
      expect(alignSpy).toHaveBeenCalled();
      expect(harness.service.getFileContext(deviceId)()?.files).toEqual(files);

      alignSpy.mockClear();
      await harness.service.next(deviceId);
      expect(alignSpy).toHaveBeenCalled();
    });

    it('creates a running timer when navigating backward to a music entry', async () => {
      const musicFile = createTestFileItem({
        type: FileItemType.Song,
        playLength: '3:00',
        path: '/music/song.sid',
      });
      await launch(musicFile);
      harness.service.toggleShuffleMode(deviceId);
      harness.playerService.launchFile = vi.fn(() => of(musicFile));

      await harness.service.previous(deviceId);

      const timer = harness.service.getTimerState(deviceId)();
      expect(timer?.isRunning).toBe(true);
      expect(timer?.totalTime).toBe(180000);
    });

    it('launches the following entry via launchFile from a middle position, without adding an entry', async () => {
      const files = await seedHistory(['file1', 'file2', 'file3']);
      harness.playerService.launchFile = vi.fn((_id, file) => of(file));
      await harness.service.previous(deviceId);
      await harness.service.previous(deviceId);
      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(1);
      harness.playerService.launchRandom = vi.fn();

      await harness.service.next(deviceId);

      expect(harness.playerService.launchFile).toHaveBeenLastCalledWith(deviceId, files[2]);
      expect(harness.playerService.launchRandom).not.toHaveBeenCalled();
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(3);
      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(2);
    });

    it('launches a brand-new random file at the newest entry, appending rather than truncating forward history', async () => {
      const files = await seedHistory(['file1', 'file2', 'file3']);
      const newRandomFile = createTestFileItem({ path: '/music/brand-new.sid' });
      harness.playerService.launchRandom = vi.fn(() => of(newRandomFile));

      await harness.service.next(deviceId);

      expect(harness.playerService.launchRandom).toHaveBeenCalledTimes(1);
      const history = harness.service.getPlayHistory(deviceId)();
      expect(history?.entries).toHaveLength(4);
      expect(history?.entries[3].file).toEqual(newRandomFile);
      expect(history?.entries.slice(0, 3).map((e) => e.file)).toEqual(files);
    });
  });

  describe('back/forward navigation edge cases', () => {
    it('with one entry, previous() lands on it and next() launches a new random file', async () => {
      const only = createTestFileItem({ path: '/music/only.sid' });
      await launch(only);
      harness.service.toggleShuffleMode(deviceId);
      harness.playerService.launchFile = vi.fn(() => of(only));

      await harness.service.previous(deviceId);
      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(0);

      const randomFile = createTestFileItem({ path: '/music/random.sid' });
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));
      await harness.service.next(deviceId);

      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(2);
    });

    it('is a safe no-op for previous() with no history, while next() performs a normal new launch', async () => {
      await expect(harness.service.previous(deviceId)).resolves.not.toThrow();
      expect(harness.service.getPlayHistory(deviceId)()).toBeNull();

      harness.playerService.launchRandom = vi.fn(() => of(createTestFileItem()));
      harness.service.toggleShuffleMode(deviceId);
      await harness.service.next(deviceId);

      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(1);
    });

    it.each(['previous', 'next'] as const)(
      'leaves the history position unchanged and sets an error when %s() fails to launch',
      async (direction) => {
        // A middle position (neither end) makes both previous() and next() take the
        // history-navigation branch, so both directions exercise the same failure path.
        await seedHistory(['a', 'b', 'c']);
        harness.playerService.launchFile = vi.fn((_id, file) => of(file));
        await harness.service.previous(deviceId);
        await harness.service.previous(deviceId);
        const positionBefore = harness.service.getCurrentHistoryPosition(deviceId)();

        harness.playerService.launchFile = vi.fn(() => throwError(() => new Error('failed')));
        await harness.service[direction](deviceId);

        expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(positionBefore);
        expect(harness.service.getError(deviceId)()).toBeTruthy();
      }
    );

    it("navigating one device's history doesn't affect another device's", async () => {
      const other = 'device-history-other';
      harness.service.initializePlayer(other);
      await launch(createTestFileItem({ path: '/music/primary.sid' }));
      harness.playerService.launchFile = vi.fn(() => of(createTestFileItem({ path: '/music/other.sid' })));
      await harness.service.launchFileWithContext({
        deviceId: other,
        file: createTestFileItem({ path: '/music/other.sid' }),
        directoryPath: '/music',
        files: [createTestFileItem({ path: '/music/other.sid' })],
      });
      const otherHistoryBefore = harness.service.getPlayHistory(other)();

      harness.service.toggleShuffleMode(deviceId);
      harness.playerService.launchFile = vi.fn((_id, file) => of(file));
      await harness.service.previous(deviceId);

      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(0);
      expect(harness.service.getPlayHistory(other)()).toEqual(otherHistoryBefore);
    });

    it('still launches the file when the directory realignment fails during backward navigation', async () => {
      const files = await seedHistory(['file1', 'file2']);
      harness.playerService.launchFile = vi.fn((_id, file) => of(file));
      vi.spyOn(harness.storageStore, 'alignToPlayingFile').mockRejectedValue(
        new Error('alignment failed')
      );

      await harness.service.previous(deviceId);

      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(files[1]);
      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(1);
    });

    it('walks backward and forward through history, ending at the expected position and file', async () => {
      const files = await seedHistory(['file1', 'file2', 'file3', 'file4', 'file5']);
      harness.playerService.launchFile = vi.fn((_id, file) => of(file));

      await harness.service.previous(deviceId); // -> 4
      await harness.service.previous(deviceId); // -> 3
      await harness.service.previous(deviceId); // -> 2
      await harness.service.next(deviceId); // -> 3
      await harness.service.next(deviceId); // -> 4
      await harness.service.previous(deviceId); // -> 3

      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(3);
      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(files[3]);
    });

    it('keeps history intact and navigable across shuffle/directory mode toggles', async () => {
      const files = await seedHistory(['file1', 'file2']);
      const before = harness.service.getPlayHistory(deviceId)();

      harness.service.toggleShuffleMode(deviceId); // back to Directory
      harness.service.toggleShuffleMode(deviceId); // back to Shuffle
      expect(harness.service.getPlayHistory(deviceId)()).toEqual(before);

      harness.playerService.launchFile = vi.fn((_id, file) => of(file));
      await harness.service.previous(deviceId);

      expect(harness.service.getCurrentFile(deviceId)()?.file).toEqual(files[1]);
      expect(harness.service.canNavigateBackwardInHistory(deviceId)()).toBe(true);
    });

    it('appends a new entry after browsing back and forward, without discarding what remains reachable', async () => {
      const files = await seedHistory(['file1', 'file2', 'file3', 'file4']);
      harness.playerService.launchFile = vi.fn((_id, file) => of(file));

      await harness.service.previous(deviceId); // -> 2
      await harness.service.previous(deviceId); // -> 1
      await harness.service.next(deviceId); // -> 2

      const newRandomFile = createTestFileItem({ path: '/music/new.sid' });
      harness.playerService.launchRandom = vi.fn(() => of(newRandomFile));
      await harness.service.next(deviceId); // newest -> random launch appended

      const history = harness.service.getPlayHistory(deviceId)();
      expect(history?.entries).toHaveLength(5);
      expect(history?.entries.slice(0, 4).map((e) => e.file)).toEqual(files);
      expect(history?.entries[4].file).toEqual(newRandomFile);
    });
  });

  describe('history view visibility', () => {
    it('defaults to hidden and flips each time it is toggled', () => {
      expect(harness.service.isHistoryViewVisible(deviceId)()).toBe(false);

      harness.service.toggleHistoryView(deviceId);
      expect(harness.service.isHistoryViewVisible(deviceId)()).toBe(true);

      harness.service.toggleHistoryView(deviceId);
      expect(harness.service.isHistoryViewVisible(deviceId)()).toBe(false);
    });

    it('tracks visibility per device', () => {
      const other = 'device-history-other';
      harness.service.initializePlayer(other);

      harness.service.toggleHistoryView(deviceId);

      expect(harness.service.isHistoryViewVisible(deviceId)()).toBe(true);
      expect(harness.service.isHistoryViewVisible(other)()).toBe(false);
    });

    it('navigating to a specific history position keeps an open view visible and does not add an entry', async () => {
      const files = await seedHistory(['file1', 'file2', 'file3']);
      harness.service.toggleHistoryView(deviceId);
      harness.playerService.launchFile = vi.fn(() => of(files[0]));

      await harness.service.navigateToHistoryPosition(deviceId, 0);

      expect(harness.service.isHistoryViewVisible(deviceId)()).toBe(true);
      expect(harness.service.getCurrentHistoryPosition(deviceId)()).toBe(0);
      expect(harness.service.getPlayHistory(deviceId)()?.entries).toHaveLength(3);
    });

    it('closes an open history view when a new file is launched via launchFileWithContext', async () => {
      await launch(createTestFileItem({ path: '/music/song1.sid' }));
      harness.service.toggleHistoryView(deviceId);
      expect(harness.service.isHistoryViewVisible(deviceId)()).toBe(true);

      await launch(createTestFileItem({ path: '/music/song2.sid' }));

      expect(harness.service.isHistoryViewVisible(deviceId)()).toBe(false);
    });
  });
});
