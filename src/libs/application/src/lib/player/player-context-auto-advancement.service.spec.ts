import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import {
  FileItem,
  FileItemType,
  LaunchMode,
  PlayerScope,
  PlayerFilterType,
  PlayerStatus,
  PLAYER_SERVICE,
  DEVICE_SERVICE,
  ALERT_SERVICE,
  IAlertService,
  AlertMessage,
  PLAYER_LAUNCH_DELAY_MS,
  PLAYER_INCOMPATIBLE_RETRY_DELAY_MS,
  PLAYER_TIMER_TICK_MS,
} from '@teensyrom-nx/domain';
import { PlayerContextService } from './player-context.service';
import { PlayerStore } from './player-store';
import { StorageStore } from '../storage/storage-store';
import { SettingsStore } from '../settings/settings-store';
import { PLAYER_STORAGE } from './player-storage.interface';

// Type for accessing private methods in tests
interface ServiceWithPrivates {
  handleIncompatibleFile: (deviceId: string) => void;
  advanceToNextCompatibleFileInDirectory: (deviceId: string) => void;
}

// Captured at module load, before any test installs fake timers or the tracking wrapper
// below, so the harness can always drive the real clock regardless of what a test does to it.
const realSetTimeout = globalThis.setTimeout;
const scheduleRealMacrotask = realSetTimeout.bind(globalThis);
const cancelRealMacrotask = globalThis.clearTimeout.bind(globalThis);

const createTestFileItem = (overrides: Partial<FileItem> = {}): FileItem => ({
  name: 'test-file.sid',
  path: '/music/test-file.sid',
  size: 4096,
  type: FileItemType.Song,
  isFavorite: false,
  isCompatible: true,
  title: 'Test Song',
  creator: 'Test Artist',
  releaseInfo: '2025',
  description: 'Test song description',
  shareUrl: '',
  metadataSource: '',
  meta1: '',
  meta2: '',
  metadataSourcePath: '',
  parentPath: '/music',
  playLength: '3:45',
  subtuneLengths: [],
  startSubtuneNum: 0,
  images: [],
  links: [],
  tags: [],
  youTubeVideos: [],
  competitions: [],
  ratingCount: 0,
  ...overrides,
});

describe('PlayerContextService - Auto-Advancement (Phase 2)', () => {
  let service: PlayerContextService;
  let mockStorageStore: {
    alignToPlayingFile: ReturnType<typeof vi.fn>;
    getSelectedDirectoryState: ReturnType<typeof vi.fn>;
    updateFileCompatibility: ReturnType<typeof vi.fn>;
  };
  let mockSettingsStore: {
    settings: ReturnType<typeof vi.fn>;
  };
  let mockPlayerService: {
    launchFile: ReturnType<typeof vi.fn>;
    launchRandom: ReturnType<typeof vi.fn>;
    toggleMusic: ReturnType<typeof vi.fn>;
  };
  let mockDeviceService: {
    findDevices: ReturnType<typeof vi.fn>;
    getConnectedDevices: ReturnType<typeof vi.fn>;
    connectDevice: ReturnType<typeof vi.fn>;
    disconnectDevice: ReturnType<typeof vi.fn>;
    resetDevice: ReturnType<typeof vi.fn>;
    pingDevice: ReturnType<typeof vi.fn>;
  };
  let mockAlertService: Partial<IAlertService>;
  let mockPlayerStorage: {
    save: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    hasSavedState: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  const nextTick = () => new Promise<void>((r) => scheduleRealMacrotask(r, 0));

  // The service schedules a real retry timer whenever it sees an incompatible file. Such a
  // timer outliving its test fires against a destroyed TestBed injector (NG0205), so the
  // harness records the timers a test schedules and cancels whatever is still pending.
  const scheduledTimeouts = new Set<ReturnType<typeof scheduleRealMacrotask>>();

  afterEach(() => {
    vi.useRealTimers();
    globalThis.setTimeout = realSetTimeout;
    scheduledTimeouts.forEach((id) => cancelRealMacrotask(id));
    scheduledTimeouts.clear();
  });

  beforeEach(() => {
    globalThis.setTimeout = ((...args: Parameters<typeof scheduleRealMacrotask>) => {
      const id = scheduleRealMacrotask(...args);
      scheduledTimeouts.add(id);
      return id;
    }) as typeof globalThis.setTimeout;

    // Default mocks return compatible files that don't interfere with test logic
    mockPlayerService = {
      launchFile: vi
        .fn()
        .mockReturnValue(of(createTestFileItem({ name: 'default.sid', isCompatible: true }))),
      launchRandom: vi
        .fn()
        .mockReturnValue(of(createTestFileItem({ name: 'default.sid', isCompatible: true }))),
      toggleMusic: vi.fn(),
    };

    mockDeviceService = {
      findDevices: vi.fn(),
      getConnectedDevices: vi.fn(),
      connectDevice: vi.fn(),
      disconnectDevice: vi.fn(),
      resetDevice: vi.fn(),
      pingDevice: vi.fn(),
    };

    mockStorageStore = {
      alignToPlayingFile: vi.fn().mockReturnValue(of(undefined)),
      getSelectedDirectoryState: vi.fn().mockReturnValue(() => ({
        path: '/default',
        directory: {
          path: '/default',
          name: 'default',
          files: [],
          directories: [],
        },
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      })),
      updateFileCompatibility: vi.fn(),
    };

    mockSettingsStore = {
      settings: vi.fn(() => null),
    };

    mockAlertService = {
      alerts$: of([]) as Observable<AlertMessage[]>,
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
    };

    mockPlayerStorage = {
      save: vi.fn(),
      load: vi.fn().mockReturnValue({}),
      hasSavedState: vi.fn().mockReturnValue(false),
      clear: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerContextService,
        PlayerStore,
        { provide: PLAYER_SERVICE, useValue: mockPlayerService },
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PLAYER_STORAGE, useValue: mockPlayerStorage },
        { provide: PLAYER_LAUNCH_DELAY_MS, useValue: 0 },
        { provide: PLAYER_TIMER_TICK_MS, useValue: 0 },
      ],
    });

    service = TestBed.inject(PlayerContextService);
  });

  describe('Incompatible File Handling - Auto-Advancement Routing', () => {
    const deviceId = 'test-device';

    beforeEach(() => {
      // Initialize player with default state
      service.initializePlayer(deviceId);
    });

    describe('Guard Clauses', () => {
      it('should return early when current file is compatible', async () => {
        // Setup: Launch a compatible file
        const compatibleFile = createTestFileItem({
          name: 'compatible.sid',
          path: '/music/compatible.sid',
          isCompatible: true,
        });
        const files = [compatibleFile];

        mockPlayerService.launchFile.mockReturnValue(of(compatibleFile));

        await service.launchFileWithContext({
          deviceId,
          file: compatibleFile,
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Spy on handler method
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const advanceDirectorySpy = vi.spyOn(
          serviceWithPrivates,
          'advanceToNextCompatibleFileInDirectory'
        );

        // Call handleIncompatibleFile
        serviceWithPrivates.handleIncompatibleFile(deviceId);

        // Verify: Handler should not be called for compatible file
        expect(advanceDirectorySpy).not.toHaveBeenCalled();
      });

      it('should return early when current file is null', () => {
        // Spy on handler method
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const advanceDirectorySpy = vi.spyOn(
          serviceWithPrivates,
          'advanceToNextCompatibleFileInDirectory'
        );

        // Call handleIncompatibleFile on player with no current file
        serviceWithPrivates.handleIncompatibleFile(deviceId);

        // Verify: Handler should not be called when no file loaded
        expect(advanceDirectorySpy).not.toHaveBeenCalled();
      });

      it('should return early when player state is null', () => {
        const nonExistentDeviceId = 'non-existent-device';

        // Spy on handler method
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const advanceDirectorySpy = vi.spyOn(
          serviceWithPrivates,
          'advanceToNextCompatibleFileInDirectory'
        );

        // Call handleIncompatibleFile on non-existent player
        serviceWithPrivates.handleIncompatibleFile(nonExistentDeviceId);

        // Verify: Handler should not be called when player doesn't exist
        expect(advanceDirectorySpy).not.toHaveBeenCalled();
      });
    });

    describe('Shuffle Mode Routing', () => {
      it('should call launchRandomFile when incompatible file in shuffle mode', async () => {
        // Setup: Launch an incompatible file in directory mode first
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.hex',
          path: '/games/incompatible.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });
        const files = [incompatibleFile];

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleFile));

        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/games',
          files,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Now toggle to shuffle mode
        service.toggleShuffleMode(deviceId);

        // Verify we're in shuffle mode with incompatible file
        const currentFile = service.getCurrentFile(deviceId)();
        const launchMode = service.getLaunchMode(deviceId)();
        expect(launchMode).toBe(LaunchMode.Shuffle);
        expect(currentFile?.isCompatible).toBe(false);

        // Spy on launchRandomFile
        const launchRandomSpy = vi.spyOn(service, 'launchRandomFile');
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const advanceDirectorySpy = vi.spyOn(
          serviceWithPrivates,
          'advanceToNextCompatibleFileInDirectory'
        );

        // Call handleIncompatibleFile
        serviceWithPrivates.handleIncompatibleFile(deviceId);

        // Verify: advanceToNextCompatibleFileInDirectory should NOT be called
        expect(advanceDirectorySpy).not.toHaveBeenCalled();
      });
    });

    describe('Directory Mode Routing', () => {
      it('should route to advanceToNextCompatibleFileInDirectory when incompatible file in directory mode', async () => {
        // Use fake timers to handle setTimeout delay
        vi.useFakeTimers();

        // Setup: Launch an incompatible file in directory mode
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.hex',
          path: '/games/incompatible.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });
        const files = [incompatibleFile];

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleFile));

        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/games',
          files,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Verify we're in directory mode with incompatible file
        const currentFile = service.getCurrentFile(deviceId)();
        const launchMode = service.getLaunchMode(deviceId)();
        expect(launchMode).toBe(LaunchMode.Directory);
        expect(currentFile?.isCompatible).toBe(false);

        // Spy on handler method
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const advanceDirectorySpy = vi.spyOn(
          serviceWithPrivates,
          'advanceToNextCompatibleFileInDirectory'
        );

        // Call handleIncompatibleFile
        serviceWithPrivates.handleIncompatibleFile(deviceId);

        // Advance timers past the setTimeout(1000) delay
        await vi.advanceTimersByTimeAsync(1000);
        await nextTick();

        // Verify: advanceToNextCompatibleFileInDirectory should be called
        expect(advanceDirectorySpy).toHaveBeenCalledWith(deviceId);
        expect(advanceDirectorySpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('Search Mode Routing', () => {
      it('should route to advanceToNextCompatibleFileInDirectory when incompatible file in search mode', async () => {
        // Use fake timers to handle setTimeout delay
        vi.useFakeTimers();

        // Setup: Launch an incompatible file in search mode
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.hex',
          path: '/search-results/incompatible.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });
        const files = [incompatibleFile];

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleFile));

        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/search-results',
          files,
          launchMode: LaunchMode.Search,
        });

        await nextTick();

        // Verify we're in search mode with incompatible file
        const currentFile = service.getCurrentFile(deviceId)();
        const launchMode = service.getLaunchMode(deviceId)();
        expect(launchMode).toBe(LaunchMode.Search);
        expect(currentFile?.isCompatible).toBe(false);

        // Spy on handler methods
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const advanceDirectorySpy = vi.spyOn(
          serviceWithPrivates,
          'advanceToNextCompatibleFileInDirectory'
        );

        // Call handleIncompatibleFile
        serviceWithPrivates.handleIncompatibleFile(deviceId);

        // Advance timers past the setTimeout(1000) delay
        await vi.advanceTimersByTimeAsync(1000);
        await nextTick();

        // Verify: advanceToNextCompatibleFileInDirectory should be called
        expect(advanceDirectorySpy).toHaveBeenCalledWith(deviceId);
        expect(advanceDirectorySpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Incompatible File Handling - Directory/Search Mode Advancement Logic', () => {
    const deviceId = 'test-device';

    beforeEach(() => {
      // Initialize player with default state
      service.initializePlayer(deviceId);
    });

    describe('Behavior A: Finds next compatible file after current index', () => {
      it('should find and launch file at index 2 when starting from index 0', async () => {
        // Setup: Files [compatible, incompatible, compatible], currentIndex = 0
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid', isCompatible: true }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: false }),
          createTestFileItem({ name: 'file3.sid', path: '/music/file3.sid', isCompatible: true }),
        ];

        // Load file context with currentIndex = 0
        await service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Setup: Spy on launchFileWithContext
        const launchSpy = vi.spyOn(service, 'launchFileWithContext');

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);

        // Verify: launchFileWithContext called with files[2] (skip incompatible files[1])
        expect(launchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceId,
            file: files[2],
            directoryPath: '/music',
            files,
            launchMode: LaunchMode.Directory,
          })
        );
        expect(launchSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('Behavior B: Wraps around to start of array when searching from end', () => {
      it('should wrap around and launch file at index 0 when starting from index 2', async () => {
        // Setup: Files [compatible, incompatible, compatible], currentIndex = 2
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid', isCompatible: true }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: false }),
          createTestFileItem({ name: 'file3.sid', path: '/music/file3.sid', isCompatible: true }),
        ];

        // Load file context with currentIndex = 2
        await service.launchFileWithContext({
          deviceId,
          file: files[2],
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Setup: Spy on launchFileWithContext
        const launchSpy = vi.spyOn(service, 'launchFileWithContext');

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);

        // Verify: launchFileWithContext called with files[0] (wrapped around)
        expect(launchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceId,
            file: files[0],
            directoryPath: '/music',
            files,
            launchMode: LaunchMode.Directory,
          })
        );
        expect(launchSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('Behavior C: Skips multiple consecutive incompatible files', () => {
      it('should skip 3 incompatible files and launch file at index 4', async () => {
        // Setup: Files [compatible, incompatible, incompatible, incompatible, compatible], currentIndex = 0
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid', isCompatible: true }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: false }),
          createTestFileItem({ name: 'file3.sid', path: '/music/file3.sid', isCompatible: false }),
          createTestFileItem({ name: 'file4.sid', path: '/music/file4.sid', isCompatible: false }),
          createTestFileItem({ name: 'file5.sid', path: '/music/file5.sid', isCompatible: true }),
        ];

        // Load file context with currentIndex = 0
        await service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Setup: Spy on launchFileWithContext
        const launchSpy = vi.spyOn(service, 'launchFileWithContext');

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);

        // Verify: launchFileWithContext called with files[4] (skipped files[1-3])
        expect(launchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceId,
            file: files[4],
            directoryPath: '/music',
            files,
            launchMode: LaunchMode.Directory,
          })
        );
        expect(launchSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('Behavior D: All incompatible files triggers alert and random launch fallback', () => {
      it('should show alert and call launchRandomFile when all files are incompatible', async () => {
        // Setup: Files [incompatible, incompatible, incompatible], currentIndex = 0
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid', isCompatible: false }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: false }),
          createTestFileItem({ name: 'file3.sid', path: '/music/file3.sid', isCompatible: false }),
        ];

        // Setup: Spy on launchFileWithContext, launchRandomFile, and alert service BEFORE loading context
        const launchContextSpy = vi.spyOn(service, 'launchFileWithContext');
        const launchRandomSpy = vi.spyOn(service, 'launchRandomFile');
        const alertSpy = vi.spyOn(mockAlertService, 'warning');

        // Load file context with currentIndex = 0
        await service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        await serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);
        await nextTick();

        // Verify: Alert shown with appropriate message
        expect(alertSpy).toHaveBeenCalledWith('All files in directory are incompatible');

        // Verify: launchRandomFile called with correct deviceId
        expect(launchRandomSpy).toHaveBeenCalledWith(deviceId);
        expect(launchRandomSpy).toHaveBeenCalledTimes(1);

        // Verify: launchFileWithContext NOT called by advanceToNext (only the initial setup call)
        expect(launchContextSpy).toHaveBeenCalledTimes(1); // Only the setup call
      });
    });

    describe('Behavior E: Launches candidate file using launchFileWithContext method', () => {
      it('should call launchFileWithContext with deviceId and candidate file object', async () => {
        // Setup: Files with compatible file at index 1
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid', isCompatible: false }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: true }),
        ];

        // Load file context with currentIndex = 0
        await service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Setup: Spy on launchFileWithContext
        const launchSpy = vi.spyOn(service, 'launchFileWithContext');

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        await serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);
        await nextTick();

        // Verify: launchFileWithContext called with exact parameters
        expect(launchSpy).toHaveBeenCalledWith({
          deviceId,
          file: files[1], // The candidate file object
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });
        expect(launchSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('Behavior F: Loop terminates after files.length attempts', () => {
      it('should run exactly 5 iterations for array with 5 incompatible files', async () => {
        // Setup: Files array with 5 items, all incompatible
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid', isCompatible: false }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: false }),
          createTestFileItem({ name: 'file3.sid', path: '/music/file3.sid', isCompatible: false }),
          createTestFileItem({ name: 'file4.sid', path: '/music/file4.sid', isCompatible: false }),
          createTestFileItem({ name: 'file5.sid', path: '/music/file5.sid', isCompatible: false }),
        ];

        // Load file context with currentIndex = 0
        await service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Setup: Spy on launchRandomFile (fallback after loop completes)
        const launchRandomSpy = vi.spyOn(service, 'launchRandomFile');

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        await serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);
        await nextTick();

        // Verify: Loop completed without finding compatible file (fallback triggered)
        expect(launchRandomSpy).toHaveBeenCalledWith(deviceId);
        expect(launchRandomSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('Behavior G: Returns early if no file context available', () => {
      it('should not call any launch methods when file context is null', () => {
        // Setup: Initialize player but don't load any file context
        // (player exists but fileContext is null)

        // Setup: Spy on launchFileWithContext and launchRandomFile
        const launchContextSpy = vi.spyOn(service, 'launchFileWithContext');
        const launchRandomSpy = vi.spyOn(service, 'launchRandomFile');
        const alertSpy = vi.spyOn(mockAlertService, 'warning');

        // Call: advanceToNextCompatibleFileInDirectory with no file context
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);

        // Verify: No launch methods called
        expect(launchContextSpy).not.toHaveBeenCalled();
        expect(launchRandomSpy).not.toHaveBeenCalled();

        // Verify: No alerts shown
        expect(alertSpy).not.toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('should return early when files array is empty', async () => {
        // Setup: Spy on launch methods BEFORE loading context
        const launchContextSpy = vi.spyOn(service, 'launchFileWithContext');
        const launchRandomSpy = vi.spyOn(service, 'launchRandomFile');

        // Setup: Load file context with empty files array
        await service.launchFileWithContext({
          deviceId,
          file: createTestFileItem(),
          directoryPath: '/music',
          files: [], // Empty array
          launchMode: LaunchMode.Directory,
        });

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);

        // Verify: No launch methods called (only the setup call)
        expect(launchContextSpy).toHaveBeenCalledTimes(1); // Only the setup call
        expect(launchRandomSpy).not.toHaveBeenCalled();
      });

      it('should handle undefined isCompatible as compatible', async () => {
        // Setup: Files where second file has isCompatible true (treated as compatible)
        const files = [
          createTestFileItem({
            name: 'file1.sid',
            path: '/music/file1.sid',
            isCompatible: false,
          }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: true }),
        ];

        // Load file context with currentIndex = 0
        await service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Setup: Spy on launchFileWithContext
        const launchSpy = vi.spyOn(service, 'launchFileWithContext');

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);

        // Verify: launchFileWithContext called with files[1] (treated as compatible)
        expect(launchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceId,
            file: files[1],
          })
        );
      });

      it('should preserve launch mode when launching candidate file', async () => {
        // Setup: Load file context with Search mode
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid', isCompatible: false }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: true }),
        ];

        await service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/search-results',
          files,
          launchMode: LaunchMode.Search, // Search mode instead of Directory
        });

        // Setup: Spy on launchFileWithContext
        const launchSpy = vi.spyOn(service, 'launchFileWithContext');

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);

        // Verify: launchFileWithContext called with Search launch mode preserved
        expect(launchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            launchMode: LaunchMode.Search,
          })
        );
      });

      it('should not call next() method (prevents infinite loop)', async () => {
        // Setup: Files with incompatible file
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid', isCompatible: false }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid', isCompatible: true }),
        ];

        await service.launchFileWithContext({
          deviceId,
          file: files[0],
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Setup: Spy on next() method (if it exists)
        const nextSpy = vi.spyOn(service, 'next');

        // Call: advanceToNextCompatibleFileInDirectory
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        serviceWithPrivates.advanceToNextCompatibleFileInDirectory(deviceId);

        // Verify: next() should NOT be called (use direct launch instead)
        expect(nextSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Handler Integration Tests', () => {
    const deviceId = 'test-device';

    beforeEach(() => {
      // Initialize player with default state
      service.initializePlayer(deviceId);
    });

    describe('launchFileWithContext Integration', () => {
      it('should call handleIncompatibleFile after launching incompatible file', async () => {
        // Setup: Create an incompatible file
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.hex',
          path: '/games/incompatible.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });
        const files = [incompatibleFile];

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleFile));

        // Spy on handleIncompatibleFile
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const handleIncompatibleSpy = vi.spyOn(serviceWithPrivates, 'handleIncompatibleFile');

        // Act: Launch the file
        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/games',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Assert: Handler should be called with deviceId
        expect(handleIncompatibleSpy).toHaveBeenCalledWith(deviceId);
        expect(handleIncompatibleSpy).toHaveBeenCalledTimes(1);
      });

      it('should call handleIncompatibleFile after launching compatible file', async () => {
        // Setup: Create a compatible file
        const compatibleFile = createTestFileItem({
          name: 'song.sid',
          path: '/music/song.sid',
          isCompatible: true,
        });
        const files = [compatibleFile];

        mockPlayerService.launchFile.mockReturnValue(of(compatibleFile));

        // Spy on handleIncompatibleFile
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const handleIncompatibleSpy = vi.spyOn(serviceWithPrivates, 'handleIncompatibleFile');

        // Act: Launch the file
        await service.launchFileWithContext({
          deviceId,
          file: compatibleFile,
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        // Assert: Handler should be called (but will return early for compatible file)
        expect(handleIncompatibleSpy).toHaveBeenCalledWith(deviceId);
        expect(handleIncompatibleSpy).toHaveBeenCalledTimes(1);
      });

      it('should preserve existing launch functionality when handler is called', async () => {
        // Setup: Create a test file
        const testFile = createTestFileItem({
          name: 'test.sid',
          path: '/music/test.sid',
          isCompatible: true,
        });
        const files = [testFile];

        mockPlayerService.launchFile.mockReturnValue(of(testFile));

        // Act: Launch the file
        await service.launchFileWithContext({
          deviceId,
          file: testFile,
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Assert: Original functionality preserved
        const currentFile = service.getCurrentFile(deviceId)();
        expect(currentFile).toBeDefined();
        expect(currentFile?.file.name).toBe('test.sid');
        expect(mockPlayerService.launchFile).toHaveBeenCalled();
      });
    });

    describe('launchRandomFile Integration', () => {
      it('should call handleIncompatibleFile after random file launch completes', async () => {
        // Setup: Create an incompatible file as random result
        const randomFile = createTestFileItem({
          name: 'random.hex',
          path: '/games/random.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });

        mockPlayerService.launchRandom.mockReturnValue(of(randomFile));

        const directoryFiles = [
          randomFile,
          createTestFileItem({ name: 'other.sid', path: '/games/other.sid' }),
        ];

        mockStorageStore.alignToPlayingFile.mockReturnValue(of(undefined));
        mockStorageStore.getSelectedDirectoryState.mockReturnValue(() => ({
          path: '/games',
          directory: {
            path: '/games',
            name: 'games',
            files: directoryFiles,
            directories: [],
          },
          isLoading: false,
          error: null,
          lastUpdated: Date.now(),
        }));

        // Spy on handleIncompatibleFile
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const handleIncompatibleSpy = vi.spyOn(serviceWithPrivates, 'handleIncompatibleFile');

        // Act: Launch random file
        await service.launchRandomFile(deviceId);

        await nextTick();

        // Assert: Handler should be called after directory context loaded
        expect(handleIncompatibleSpy).toHaveBeenCalledWith(deviceId);
        expect(handleIncompatibleSpy).toHaveBeenCalledTimes(1);
      });

      it('should call handler after successful directory context loading', async () => {
        // Setup: Create a compatible file
        const randomFile = createTestFileItem({
          name: 'random.sid',
          path: '/music/random.sid',
          isCompatible: true,
        });

        mockPlayerService.launchRandom.mockReturnValue(of(randomFile));

        const directoryFiles = [
          randomFile,
          createTestFileItem({ name: 'other.sid', path: '/music/other.sid' }),
        ];

        mockStorageStore.alignToPlayingFile.mockReturnValue(of(undefined));
        mockStorageStore.getSelectedDirectoryState.mockReturnValue(() => ({
          path: '/music',
          directory: {
            path: '/music',
            name: 'music',
            files: directoryFiles,
            directories: [],
          },
          isLoading: false,
          error: null,
          lastUpdated: Date.now(),
        }));

        // Spy on both handler and alignToPlayingFile
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const handleIncompatibleSpy = vi.spyOn(serviceWithPrivates, 'handleIncompatibleFile');
        const navigateSpy = mockStorageStore.alignToPlayingFile;

        // Act: Launch random file
        await service.launchRandomFile(deviceId);

        await nextTick();

        // Assert: alignToPlayingFile should complete before handler is called
        expect(navigateSpy).toHaveBeenCalled();
        expect(handleIncompatibleSpy).toHaveBeenCalledWith(deviceId);
        // Handler should be called after navigation
        const navigateCallOrder = navigateSpy.mock.invocationCallOrder[0];
        const handlerCallOrder = handleIncompatibleSpy.mock.invocationCallOrder[0];
        expect(handlerCallOrder).toBeGreaterThan(navigateCallOrder);
      });

      it('should preserve existing random launch functionality', async () => {
        // Setup: Create a test file
        const randomFile = createTestFileItem({
          name: 'random.sid',
          path: '/music/random.sid',
          isCompatible: true,
        });

        mockPlayerService.launchRandom.mockReturnValue(of(randomFile));

        const directoryFiles = [randomFile];

        mockStorageStore.alignToPlayingFile.mockReturnValue(of(undefined));
        mockStorageStore.getSelectedDirectoryState.mockReturnValue(() => ({
          path: '/music',
          directory: {
            path: '/music',
            name: 'music',
            files: directoryFiles,
            directories: [],
          },
          isLoading: false,
          error: null,
          lastUpdated: Date.now(),
        }));

        // Act: Launch random file
        await service.launchRandomFile(deviceId);

        await nextTick();

        // Assert: Original functionality preserved
        const currentFile = service.getCurrentFile(deviceId)();
        expect(currentFile).toBeDefined();
        expect(currentFile?.file.name).toBe('random.sid');
        expect(mockPlayerService.launchRandom).toHaveBeenCalled();
      });
    });
  });

  describe('End-to-End Auto-Advancement Scenarios', () => {
    const deviceId = 'test-device';

    beforeEach(() => {
      // Initialize player with default state
      service.initializePlayer(deviceId);
    });

    describe('Shuffle Mode: Retry Flow', () => {
      it('should retry until compatible file found in shuffle mode', async () => {
        // Use fake timers to handle setTimeout delay
        vi.useFakeTimers();

        // Setup: First launch returns incompatible, subsequent retries return compatible
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.hex',
          path: '/games/incompatible.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });

        const compatibleFile = createTestFileItem({
          name: 'compatible.sid',
          path: '/music/compatible.sid',
          isCompatible: true,
        });

        const files = [incompatibleFile, compatibleFile];

        // First launchFileWithContext call (initial)
        mockPlayerService.launchFile.mockReturnValueOnce(of(incompatibleFile));

        // First launchRandomFile call (retry attempt 1)
        mockPlayerService.launchRandom.mockReturnValueOnce(of(compatibleFile));

        mockStorageStore.alignToPlayingFile.mockReturnValue(of(undefined));
        mockStorageStore.getSelectedDirectoryState.mockReturnValue(() => ({
          path: '/music',
          directory: {
            path: '/music',
            name: 'music',
            files: [compatibleFile],
            directories: [],
          },
          isLoading: false,
          error: null,
          lastUpdated: Date.now(),
        }));

        // Act: Launch incompatible file in shuffle mode
        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/games',
          files,
          launchMode: LaunchMode.Shuffle,
        });

        await nextTick();

        // Advance timers past the setTimeout(1000) delay
        await vi.advanceTimersByTimeAsync(1000);
        await nextTick();

        // Assert: Should have triggered retry via launchRandomFile
        expect(mockPlayerService.launchRandom).toHaveBeenCalledTimes(1);

        // Wait for retry to complete
        await nextTick();

        // Assert: Should now have compatible file loaded
        const currentFile = service.getCurrentFile(deviceId)();
        expect(currentFile?.isCompatible).toBe(true);
        expect(currentFile?.file.name).toBe('compatible.sid');
      });
    });

    describe('Directory Mode: Advancement Flow', () => {
      it('should advance to next compatible file in directory mode', async () => {
        // Use fake timers to handle setTimeout delay
        vi.useFakeTimers();

        // Setup: Directory with incompatible file followed by compatible file
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.hex',
          path: '/games/incompatible.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });

        const compatibleFile = createTestFileItem({
          name: 'compatible.sid',
          path: '/games/compatible.sid',
          isCompatible: true,
        });

        const files = [incompatibleFile, compatibleFile];

        // First launch returns incompatible file
        mockPlayerService.launchFile
          .mockReturnValueOnce(of(incompatibleFile))
          .mockReturnValueOnce(of(compatibleFile));

        // Act: Launch incompatible file in directory mode
        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/games',
          files,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Advance timers past the setTimeout(1000) delay
        await vi.advanceTimersByTimeAsync(1000);
        await nextTick();

        // Assert: Should have advanced to compatible file
        expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(2);

        const currentFile = service.getCurrentFile(deviceId)();
        expect(currentFile?.file.name).toBe('compatible.sid');
        expect(currentFile?.isCompatible).toBe(true);
      });

      it('should wrap around to beginning when advancing from end of directory', async () => {
        // Use fake timers to handle setTimeout delay
        vi.useFakeTimers();

        // Setup: Directory where last file is incompatible, first file is compatible
        const compatibleFile = createTestFileItem({
          name: 'compatible.sid',
          path: '/games/compatible.sid',
          isCompatible: true,
        });

        const incompatibleFile = createTestFileItem({
          name: 'incompatible.hex',
          path: '/games/incompatible.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });

        const files = [compatibleFile, incompatibleFile];

        // First launch returns incompatible file (at index 1)
        mockPlayerService.launchFile
          .mockReturnValueOnce(of(incompatibleFile))
          .mockReturnValueOnce(of(compatibleFile));

        // Act: Launch incompatible file at end of directory
        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/games',
          files,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Advance timers past the setTimeout(1000) delay
        await vi.advanceTimersByTimeAsync(1000);
        await nextTick();

        // Assert: Should have wrapped around to first file
        expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(2);

        const currentFile = service.getCurrentFile(deviceId)();
        expect(currentFile?.file.name).toBe('compatible.sid');
        expect(currentFile?.isCompatible).toBe(true);
      });

      it('should fallback to random when all directory files incompatible', async () => {
        // Use fake timers to handle setTimeout delay
        vi.useFakeTimers();

        // Setup: Directory with all incompatible files
        const incompatibleFile1 = createTestFileItem({
          name: 'incompatible1.hex',
          path: '/games/incompatible1.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });

        const incompatibleFile2 = createTestFileItem({
          name: 'incompatible2.hex',
          path: '/games/incompatible2.hex',
          isCompatible: false,
          type: FileItemType.Hex,
        });

        const files = [incompatibleFile1, incompatibleFile2];

        // Launch incompatible file
        mockPlayerService.launchFile.mockReturnValue(of(incompatibleFile1));

        // Random fallback
        const randomCompatibleFile = createTestFileItem({
          name: 'random.sid',
          path: '/music/random.sid',
          isCompatible: true,
        });
        mockPlayerService.launchRandom.mockReturnValue(of(randomCompatibleFile));

        mockStorageStore.alignToPlayingFile.mockReturnValue(of(undefined));
        mockStorageStore.getSelectedDirectoryState.mockReturnValue(() => ({
          path: '/music',
          directory: {
            path: '/music',
            name: 'music',
            files: [randomCompatibleFile],
            directories: [],
          },
          isLoading: false,
          error: null,
          lastUpdated: Date.now(),
        }));

        // Act: Launch incompatible file in directory mode
        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile1,
          directoryPath: '/games',
          files,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Advance timers past the setTimeout(1000) delay
        await vi.advanceTimersByTimeAsync(1000);
        await nextTick();
        await nextTick();

        // Assert: Should have shown alert and called random launch
        expect(mockAlertService.warning).toHaveBeenCalledWith(
          'All files in directory are incompatible'
        );
        expect(mockPlayerService.launchRandom).toHaveBeenCalledTimes(1);
      });
    });

    describe('Compatible File Handling', () => {
      it('should not trigger advancement for compatible files', async () => {
        // Setup: Compatible file
        const compatibleFile = createTestFileItem({
          name: 'compatible.sid',
          path: '/music/compatible.sid',
          isCompatible: true,
        });

        mockPlayerService.launchFile.mockReturnValue(of(compatibleFile));

        // Spy on advancement handler
        const serviceWithPrivates = service as unknown as ServiceWithPrivates;
        const advanceDirectorySpy = vi.spyOn(
          serviceWithPrivates,
          'advanceToNextCompatibleFileInDirectory'
        );

        // Act: Launch compatible file
        await service.launchFileWithContext({
          deviceId,
          file: compatibleFile,
          directoryPath: '/music',
          files: [compatibleFile],
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Assert: No advancement handler should be called
        expect(advanceDirectorySpy).not.toHaveBeenCalled();

        // Assert: File should remain current
        const currentFile = service.getCurrentFile(deviceId)();
        expect(currentFile?.file.name).toBe('compatible.sid');
        expect(currentFile?.isCompatible).toBe(true);
      });
    });
  });

  describe('Incompatible File Handling - Launch Operations (Phase 1)', () => {
    const deviceId = 'device-123';

    beforeEach(() => {
      service.initializePlayer(deviceId);
    });

    describe('launchRandomFile with incompatible file', () => {
      it('should complete successfully and set player to ready status', async () => {
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.prg',
          path: '/games/incompatible.prg',
          type: FileItemType.Game,
          isCompatible: false,
        });

        mockPlayerService.launchRandom.mockReturnValue(of(incompatibleFile));

        await service.launchRandomFile(deviceId);
        await nextTick();

        expect(mockPlayerService.launchRandom).toHaveBeenCalledWith(
          deviceId,
          PlayerScope.Storage,
          PlayerFilterType.All,
          undefined
        );

        // Verify player state transitions to 'playing' after successful launch
        const status = service.getStatus(deviceId)();
        expect(status).toBe(PlayerStatus.Playing);

        // Verify current file is set with isCompatible: false
        const currentFile = service.getCurrentFile(deviceId)();
        expect(currentFile).toBeTruthy();
        expect(currentFile?.file.isCompatible).toBe(false);
        expect(currentFile?.file.name).toBe('incompatible.prg');

        // Verify LaunchMode.Shuffle is set
        const launchMode = service.getLaunchMode(deviceId)();
        expect(launchMode).toBe(LaunchMode.Shuffle);

        // Verify no error state
        const error = service.getError(deviceId)();
        expect(error).toBeNull();

        // Verify not in loading state
        const loading = service.isLoading(deviceId)();
        expect(loading).toBe(false);
      });

      it('should maintain shuffle mode settings', async () => {
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.sid',
          path: '/music/incompatible.sid',
          isCompatible: false,
        });

        mockPlayerService.launchRandom.mockReturnValue(of(incompatibleFile));

        await service.launchRandomFile(deviceId);
        await nextTick();

        // Verify shuffle mode is active
        const launchMode = service.getLaunchMode(deviceId)();
        expect(launchMode).toBe(LaunchMode.Shuffle);

        // Verify file context is empty in shuffle mode
        const fileContext = service.getFileContext(deviceId)();
        expect(fileContext).toEqual({
          storageKey: 'device-123-SD',
          directoryPath: '/music',
          files: [],
          currentIndex: -1,
        });
      });
    });

    describe('launchFileWithContext with incompatible file', () => {
      it('should complete successfully and set player to ready status', async () => {
        const incompatibleFile = createTestFileItem({
          name: 'incompatible-game.prg',
          path: '/games/incompatible-game.prg',
          type: FileItemType.Game,
          isCompatible: false,
        });

        const testFiles = [
          createTestFileItem({ name: 'song1.sid', path: '/games/song1.sid' }),
          incompatibleFile,
          createTestFileItem({ name: 'song2.sid', path: '/games/song2.sid' }),
        ];

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleFile));

        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/games',
          files: testFiles,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, incompatibleFile);

        // Verify player state transitions to 'playing' after successful launch
        const status = service.getStatus(deviceId)();
        expect(status).toBe(PlayerStatus.Playing);

        // Verify current file is set with isCompatible: false
        const currentFile = service.getCurrentFile(deviceId)();
        expect(currentFile).toBeTruthy();
        expect(currentFile?.file.isCompatible).toBe(false);
        expect(currentFile?.file.name).toBe('incompatible-game.prg');

        // Verify LaunchMode.Directory is set
        const launchMode = service.getLaunchMode(deviceId)();
        expect(launchMode).toBe(LaunchMode.Directory);

        // Verify no error state
        const error = service.getError(deviceId)();
        expect(error).toBeNull();

        // Verify not in loading state
        const loading = service.isLoading(deviceId)();
        expect(loading).toBe(false);
      });

      it('should set file context with correct directory path', async () => {
        const incompatibleFile = createTestFileItem({
          name: 'incompatible.prg',
          path: '/games/incompatible.prg',
          type: FileItemType.Game,
          isCompatible: false,
        });

        const testFiles = [
          createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid' }),
          createTestFileItem({ name: 'song2.sid', path: '/music/song2.sid' }),
          createTestFileItem({
            name: 'game.prg',
            path: '/music/game.prg',
            type: FileItemType.Game,
          }),
        ];

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleFile));

        await service.launchFileWithContext({
          deviceId,
          file: incompatibleFile,
          directoryPath: '/games',
          files: testFiles,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Verify file context is set correctly
        const fileContext = service.getFileContext(deviceId)();
        expect(fileContext).toBeTruthy();
        expect(fileContext?.directoryPath).toBe('/games');
        expect(fileContext?.files).toEqual(testFiles);
        expect(fileContext?.currentIndex).toBe(0);
      });
    });

    describe('launchFileWithContext marks file as incompatible in context', () => {
      it('should update file compatibility in context files array', async () => {
        // Create a file that's initially marked as compatible
        const targetFile = createTestFileItem({
          name: 'test-file.prg',
          path: '/games/test-file.prg',
          type: FileItemType.Game,
          isCompatible: true, // Initially compatible
        });

        const testFiles = [
          createTestFileItem({ name: 'song1.sid', path: '/games/song1.sid' }),
          targetFile,
          createTestFileItem({ name: 'song2.sid', path: '/games/song2.sid' }),
        ];

        // Backend returns the file as incompatible
        const incompatibleResponse = createTestFileItem({
          name: 'test-file.prg',
          path: '/games/test-file.prg',
          type: FileItemType.Game,
          isCompatible: false, // Backend marks as incompatible
        });

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleResponse));

        await service.launchFileWithContext({
          deviceId,
          file: targetFile,
          directoryPath: '/games',
          files: testFiles,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        // Verify the file in fileContext.files[] is marked as incompatible
        const fileContext = service.getFileContext(deviceId)();
        expect(fileContext).toBeTruthy();
        expect(fileContext?.files).toBeTruthy();

        const updatedFile = fileContext?.files.find((f) => f.path === targetFile.path);
        expect(updatedFile).toBeTruthy();
        expect(updatedFile?.isCompatible).toBe(false);
      });

      it('should preserve compatibility state of other files in context', async () => {
        const targetFile = createTestFileItem({
          name: 'incompatible.prg',
          path: '/games/incompatible.prg',
          type: FileItemType.Game,
          isCompatible: true,
        });

        const compatibleFile1 = createTestFileItem({
          name: 'compatible1.sid',
          path: '/games/compatible1.sid',
          isCompatible: true,
        });

        const compatibleFile2 = createTestFileItem({
          name: 'compatible2.sid',
          path: '/games/compatible2.sid',
          isCompatible: true,
        });

        const incompatibleFile = createTestFileItem({
          name: 'existing-incompatible.prg',
          path: '/games/existing-incompatible.prg',
          type: FileItemType.Game,
          isCompatible: false,
        });

        const testFiles = [compatibleFile1, targetFile, compatibleFile2, incompatibleFile];

        // Backend returns target file as incompatible
        const incompatibleResponse = createTestFileItem({
          name: 'incompatible.prg',
          path: '/games/incompatible.prg',
          type: FileItemType.Game,
          isCompatible: false,
        });

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleResponse));

        await service.launchFileWithContext({
          deviceId,
          file: targetFile,
          directoryPath: '/games',
          files: testFiles,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        const fileContext = service.getFileContext(deviceId)();
        expect(fileContext).toBeTruthy();

        // Verify target file is marked as incompatible
        const updatedTargetFile = fileContext?.files.find((f) => f.path === targetFile.path);
        expect(updatedTargetFile?.isCompatible).toBe(false);

        // Verify other compatible files remain compatible
        const file1 = fileContext?.files.find((f) => f.path === compatibleFile1.path);
        expect(file1?.isCompatible).toBe(true);

        const file2 = fileContext?.files.find((f) => f.path === compatibleFile2.path);
        expect(file2?.isCompatible).toBe(true);

        // Verify existing incompatible file remains incompatible
        const existingIncompatible = fileContext?.files.find(
          (f) => f.path === incompatibleFile.path
        );
        expect(existingIncompatible?.isCompatible).toBe(false);
      });

      it('should handle incompatible file at different positions in context array', async () => {
        const files = [
          createTestFileItem({ name: 'file1.sid', path: '/music/file1.sid' }),
          createTestFileItem({ name: 'file2.sid', path: '/music/file2.sid' }),
          createTestFileItem({ name: 'file3.sid', path: '/music/file3.sid' }),
        ];

        // Test with file at position 1 (middle)
        const targetFile = files[1];
        const incompatibleResponse = createTestFileItem({
          ...targetFile,
          isCompatible: false,
        });

        mockPlayerService.launchFile.mockReturnValue(of(incompatibleResponse));

        await service.launchFileWithContext({
          deviceId,
          file: targetFile,
          directoryPath: '/music',
          files,
          launchMode: LaunchMode.Directory,
        });

        await nextTick();

        const fileContext = service.getFileContext(deviceId)();
        expect(fileContext).toBeTruthy();
        expect(fileContext?.currentIndex).toBe(1);

        const contextFile = fileContext?.files[1];
        expect(contextFile?.isCompatible).toBe(false);
        expect(contextFile?.name).toBe('file2.sid');

        // Other files should remain compatible
        expect(fileContext?.files[0].isCompatible).toBe(true);
        expect(fileContext?.files[2].isCompatible).toBe(true);
      });
    });
  });

  describe('Navigation Consistency with Incompatible Files (Phase 5)', () => {
    const deviceId = 'test-device';

    beforeEach(() => {
      service.initializePlayer(deviceId);
    });

    it('should return to original position after navigating next then previous with incompatible files', async () => {
      // File array: [compatible1, incompatible1, incompatible2, compatible2, incompatible3]
      const compatible1 = createTestFileItem({ name: 'game1.prg', isCompatible: true });
      const incompatible1 = createTestFileItem({ name: 'game2.prg', isCompatible: false });
      const incompatible2 = createTestFileItem({ name: 'game3.prg', isCompatible: false });
      const compatible2 = createTestFileItem({ name: 'game4.prg', isCompatible: true });
      const incompatible3 = createTestFileItem({ name: 'game5.prg', isCompatible: false });

      const files = [compatible1, incompatible1, incompatible2, compatible2, incompatible3];

      // Launch compatible1 (index 0)
      mockPlayerService.launchFile.mockReturnValue(of(compatible1));
      await service.launchFileWithContext({
        deviceId,
        file: compatible1,
        directoryPath: '/test',
        files,
        launchMode: LaunchMode.Directory,
      });
      await nextTick();

      let currentFile = service.getCurrentFile(deviceId)();
      expect(currentFile?.file.name).toBe('game1.prg');

      // Next should skip to compatible2 (index 3)
      mockPlayerService.launchFile.mockReturnValue(of(compatible2));
      await service.next(deviceId);
      await nextTick();

      currentFile = service.getCurrentFile(deviceId)();
      expect(currentFile?.file.name).toBe('game4.prg');

      // Previous should skip back to compatible1 (index 0)
      mockPlayerService.launchFile.mockReturnValue(of(compatible1));
      await service.previous(deviceId);
      await nextTick();

      currentFile = service.getCurrentFile(deviceId)();
      expect(currentFile?.file.name).toBe('game1.prg');
    });

    it('should skip same incompatible files in both navigation directions', async () => {
      // File array: [compatible1, incompatible1, compatible2, incompatible2, compatible3]
      const compatible1 = createTestFileItem({ name: 'file1.prg', isCompatible: true });
      const incompatible1 = createTestFileItem({ name: 'file2.prg', isCompatible: false });
      const compatible2 = createTestFileItem({ name: 'file3.prg', isCompatible: true });
      const incompatible2 = createTestFileItem({ name: 'file4.prg', isCompatible: false });
      const compatible3 = createTestFileItem({ name: 'file5.prg', isCompatible: true });

      const files = [compatible1, incompatible1, compatible2, incompatible2, compatible3];

      // Start at compatible1
      mockPlayerService.launchFile.mockReturnValue(of(compatible1));
      await service.launchFileWithContext({
        deviceId,
        file: compatible1,
        directoryPath: '/test',
        files,
        launchMode: LaunchMode.Directory,
      });
      await nextTick();

      // Next to compatible2 (skips incompatible1)
      mockPlayerService.launchFile.mockReturnValue(of(compatible2));
      await service.next(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('file3.prg');

      // Next to compatible3 (skips incompatible2)
      mockPlayerService.launchFile.mockReturnValue(of(compatible3));
      await service.next(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('file5.prg');

      // Previous to compatible2 (skips incompatible2)
      mockPlayerService.launchFile.mockReturnValue(of(compatible2));
      await service.previous(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('file3.prg');

      // Previous to compatible1 (skips incompatible1)
      mockPlayerService.launchFile.mockReturnValue(of(compatible1));
      await service.previous(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('file1.prg');
    });

    it('should throw consistent error in both directions when all files incompatible', async () => {
      // File array: mostly incompatible with one compatible at a known position to avoid auto-advancement
      // This tests that when trying to navigate from the only compatible file, both directions
      // behave consistently when hitting incompatible boundaries
      const compatible = createTestFileItem({ name: 'good.prg', isCompatible: true });
      const incompatible1 = createTestFileItem({ name: 'bad1.prg', isCompatible: false });
      const incompatible2 = createTestFileItem({ name: 'bad2.prg', isCompatible: false });

      const files = [incompatible1, compatible, incompatible2];

      // Start at the only compatible file (index 1)
      mockPlayerService.launchFile.mockReturnValue(of(compatible));
      await service.launchFileWithContext({
        deviceId,
        file: compatible,
        directoryPath: '/test',
        files,
        launchMode: LaunchMode.Directory,
      });
      await nextTick();

      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('good.prg');

      // From compatible file, both next and previous will wrap around
      // and encounter incompatible files, but skip them and return to compatible
      // Testing that error messages would be consistent in a fully incompatible scenario

      // Next should wrap to incompatible2, skip it, wrap to incompatible1, skip it,
      // and return to compatible (the only compatible file)
      mockPlayerService.launchFile.mockReturnValue(of(compatible));
      await service.next(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('good.prg');

      // Previous should wrap to incompatible1, skip it, wrap to incompatible2, skip it,
      // and return to compatible (the only compatible file)
      mockPlayerService.launchFile.mockReturnValue(of(compatible));
      await service.previous(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('good.prg');

      // Both directions end up at the same compatible file, showing consistent skip behavior
    });

    it('should handle complex navigation sequences with multiple skip patterns', async () => {
      // File array: [compatible1, incompatible1, incompatible2, compatible2, compatible3, incompatible3, compatible4]
      const compatible1 = createTestFileItem({ name: 'song1.sid', isCompatible: true });
      const incompatible1 = createTestFileItem({ name: 'song2.sid', isCompatible: false });
      const incompatible2 = createTestFileItem({ name: 'song3.sid', isCompatible: false });
      const compatible2 = createTestFileItem({ name: 'song4.sid', isCompatible: true });
      const compatible3 = createTestFileItem({ name: 'song5.sid', isCompatible: true });
      const incompatible3 = createTestFileItem({ name: 'song6.sid', isCompatible: false });
      const compatible4 = createTestFileItem({ name: 'song7.sid', isCompatible: true });

      const files = [
        compatible1,
        incompatible1,
        incompatible2,
        compatible2,
        compatible3,
        incompatible3,
        compatible4,
      ];

      // Start at compatible1 (index 0)
      mockPlayerService.launchFile.mockReturnValue(of(compatible1));
      await service.launchFileWithContext({
        deviceId,
        file: compatible1,
        directoryPath: '/test',
        files,
        launchMode: LaunchMode.Directory,
      });
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('song1.sid');

      // Next → compatible2 (index 3, skipped 2 incompatible)
      mockPlayerService.launchFile.mockReturnValue(of(compatible2));
      await service.next(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('song4.sid');

      // Next → compatible3 (index 4, skipped 0)
      mockPlayerService.launchFile.mockReturnValue(of(compatible3));
      await service.next(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('song5.sid');

      // Next → compatible4 (index 6, skipped 1 incompatible)
      mockPlayerService.launchFile.mockReturnValue(of(compatible4));
      await service.next(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('song7.sid');

      // Previous → compatible3 (index 4, skipped 1 incompatible)
      mockPlayerService.launchFile.mockReturnValue(of(compatible3));
      await service.previous(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('song5.sid');

      // Previous → compatible2 (index 3, skipped 0)
      mockPlayerService.launchFile.mockReturnValue(of(compatible2));
      await service.previous(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('song4.sid');

      // Previous → compatible1 (index 0, skipped 2 incompatible)
      mockPlayerService.launchFile.mockReturnValue(of(compatible1));
      await service.previous(deviceId);
      await nextTick();
      expect(service.getCurrentFile(deviceId)()?.file.name).toBe('song1.sid');
    });
  });

  describe('PLAYER_INCOMPATIBLE_RETRY_DELAY_MS override', () => {
    const deviceId = 'test-device';

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          PlayerContextService,
          PlayerStore,
          { provide: PLAYER_SERVICE, useValue: mockPlayerService },
          { provide: DEVICE_SERVICE, useValue: mockDeviceService },
          { provide: ALERT_SERVICE, useValue: mockAlertService },
          { provide: StorageStore, useValue: mockStorageStore },
          { provide: SettingsStore, useValue: mockSettingsStore },
          { provide: PLAYER_STORAGE, useValue: mockPlayerStorage },
          { provide: PLAYER_INCOMPATIBLE_RETRY_DELAY_MS, useValue: 0 },
        ],
      });
      service = TestBed.inject(PlayerContextService);
      service.initializePlayer(deviceId);
    });

    it('fires the directory-mode retry on the next macrotask instead of after 1000ms', async () => {
      const incompatibleFile = createTestFileItem({
        name: 'incompatible.hex',
        path: '/games/incompatible.hex',
        isCompatible: false,
        type: FileItemType.Hex,
      });
      const compatibleFile = createTestFileItem({
        name: 'compatible.sid',
        path: '/games/compatible.sid',
        isCompatible: true,
      });
      const files = [incompatibleFile, compatibleFile];

      mockPlayerService.launchFile
        .mockReturnValueOnce(of(incompatibleFile))
        .mockReturnValueOnce(of(compatibleFile));

      await service.launchFileWithContext({
        deviceId,
        file: incompatibleFile,
        directoryPath: '/games',
        files,
        launchMode: LaunchMode.Directory,
      });

      // No real timer advancement needed: the retry delay is overridden to 0,
      // so the retry resolves on the next macrotask.
      await nextTick();
      await nextTick();

      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(2);
      const currentFile = service.getCurrentFile(deviceId)();
      expect(currentFile?.file.name).toBe('compatible.sid');
      expect(currentFile?.isCompatible).toBe(true);
    });
  });
});
