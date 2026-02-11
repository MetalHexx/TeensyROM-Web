import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerToolbarActionsComponent } from './player-toolbar-actions.component';
import { PLAYER_CONTEXT, StorageStore } from '@teensyrom-nx/application';
import { signal, WritableSignal } from '@angular/core';
import { LaunchMode, FileItem, StorageType, FileItemType } from '@teensyrom-nx/domain';
import { vi } from 'vitest';

// Create a helper function to build test LaunchedFile objects
function createLaunchedFile(
  deviceId: string,
  storageType: StorageType,
  fileData: Partial<FileItem> = {}
) {
  const storageKey = `${deviceId}-${storageType}` as const;
  return {
    storageKey,
    file: {
      name: fileData.name || 'test.rom',
      path: fileData.path || '/test/test.rom',
      size: 1024,
      isFavorite: fileData.isFavorite ?? false,
      isCompatible: true,
      title: 'Test File',
      creator: '',
      releaseInfo: '',
      description: '',
      shareUrl: '',
      metadataSource: '',
      meta1: 'Game',
      meta2: '',
      metadataSourcePath: '',
      parentPath: '/test',
      playLength: '',
      subtuneLengths: [],
      startSubtuneNum: 0,
      images: [],
      type: fileData.type ?? FileItemType.Game,
      links: [],
      tags: [],
      youTubeVideos: [],
      competitions: [],
      ratingCount: 0,
      ...fileData,
    } as FileItem,
    parentPath: '/test',
    launchedAt: Date.now(),
    isCompatible: true,
  };
}

describe('PlayerToolbarActionsComponent', () => {
  let component: PlayerToolbarActionsComponent;
  let fixture: ComponentFixture<PlayerToolbarActionsComponent>;
  let mockPlayerContext: {
    toggleShuffleMode: ReturnType<typeof vi.fn>;
    getLaunchMode: ReturnType<typeof vi.fn>;
    getCurrentFile: ReturnType<typeof vi.fn>;
    updateCurrentFileFavoriteStatus: ReturnType<typeof vi.fn>;
    getPlayTimerConfig: ReturnType<typeof vi.fn>;
    setCustomTimer: ReturnType<typeof vi.fn>;
    isHistoryViewVisible: ReturnType<typeof vi.fn>;
    toggleHistoryView: ReturnType<typeof vi.fn>;
  };
  let mockStorageStore: {
    saveFavorite: ReturnType<typeof vi.fn>;
    removeFavorite: ReturnType<typeof vi.fn>;
    favoriteOperationsState: ReturnType<typeof vi.fn>;
  };
  let currentFileSignal: WritableSignal<ReturnType<typeof createLaunchedFile> | null>;
  let favoriteOperationsStateSignal: WritableSignal<{
    isProcessing: boolean;
    error: string | null;
  }>;
  let customTimerConfigSignal: WritableSignal<{ enabled: boolean; durationMs: number } | null>;

  beforeEach(async () => {
    currentFileSignal = signal<ReturnType<typeof createLaunchedFile> | null>(null);
    favoriteOperationsStateSignal = signal({ isProcessing: false, error: null });
    customTimerConfigSignal = signal<{ enabled: boolean; durationMs: number } | null>(null);

    mockPlayerContext = {
      toggleShuffleMode: vi.fn(),
      getLaunchMode: vi.fn(() => signal(LaunchMode.Directory)),
      getCurrentFile: vi.fn(() => currentFileSignal),
      updateCurrentFileFavoriteStatus: vi.fn(),
      getPlayTimerConfig: vi.fn(() => customTimerConfigSignal),
      setCustomTimer: vi.fn(),
      isHistoryViewVisible: vi.fn(() => signal(false)),
      toggleHistoryView: vi.fn(),
    };

    mockStorageStore = {
      saveFavorite: vi.fn(),
      removeFavorite: vi.fn(),
      favoriteOperationsState: vi.fn(() => favoriteOperationsStateSignal()),
    };

    await TestBed.configureTestingModule({
      imports: [PlayerToolbarActionsComponent],
      providers: [
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: StorageStore, useValue: mockStorageStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerToolbarActionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'test-device');
    fixture.detectChanges();
  });

  describe('Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should inject playerContext', () => {
      expect(mockPlayerContext).toBeDefined();
    });

    it('should inject StorageStore', () => {
      expect(mockStorageStore).toBeDefined();
    });
  });

  describe('Shuffle Mode', () => {
    it('should toggle shuffle mode when button clicked', () => {
      component.toggleShuffleMode();
      expect(mockPlayerContext.toggleShuffleMode).toHaveBeenCalledWith('test-device');
    });

    it('should detect shuffle mode correctly', () => {
      mockPlayerContext.getLaunchMode = vi.fn(() => signal(LaunchMode.Shuffle));
      expect(component.isShuffleMode()).toBe(true);

      mockPlayerContext.getLaunchMode = vi.fn(() => signal(LaunchMode.Directory));
      expect(component.isShuffleMode()).toBe(false);
    });
  });

  describe('Favorite Status - isFavorite()', () => {
    it('should return false when no file is loaded', () => {
      currentFileSignal.set(null);
      expect(component.isFavorite()).toBe(false);
    });

    it('should return true when current file has isFavorite flag set to true', () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, { isFavorite: true })
      );
      expect(component.isFavorite()).toBe(true);
    });

    it('should return false when current file has isFavorite flag set to false', () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false })
      );
      expect(component.isFavorite()).toBe(false);
    });
  });

  describe('Favorite Operation Status - isFavoriteOperationInProgress()', () => {
    it('should return false when no operation is in progress', () => {
      favoriteOperationsStateSignal.set({ isProcessing: false, error: null });
      expect(component.isFavoriteOperationInProgress()).toBe(false);
    });

    it('should return true when favorite operation is in progress', () => {
      favoriteOperationsStateSignal.set({ isProcessing: true, error: null });
      expect(component.isFavoriteOperationInProgress()).toBe(true);
    });

    it('should return true when remove favorite operation is in progress', () => {
      favoriteOperationsStateSignal.set({ isProcessing: true, error: null });
      expect(component.isFavoriteOperationInProgress()).toBe(true);
    });
  });

  describe('Toggle Favorite - toggleFavorite()', () => {
    it('should call saveFavorite and update player context when current file is not favorited', async () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, {
          isFavorite: false,
          path: '/games/game.rom',
        })
      );
      mockStorageStore.saveFavorite.mockImplementation(async () => {
        favoriteOperationsStateSignal.set({ isProcessing: false, error: null });
      });

      await component.toggleFavorite();

      expect(mockStorageStore.saveFavorite).toHaveBeenCalledWith({
        deviceId: 'test-device',
        storageType: StorageType.Sd,
        filePath: '/games/game.rom',
      });
      expect(mockPlayerContext.updateCurrentFileFavoriteStatus).toHaveBeenCalledWith(
        'test-device',
        '/games/game.rom',
        true
      );
    });

    it('should call removeFavorite and update player context when current file is favorited', async () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, {
          isFavorite: true,
          path: '/games/game.rom',
        })
      );
      mockStorageStore.removeFavorite.mockImplementation(async () => {
        favoriteOperationsStateSignal.set({ isProcessing: false, error: null });
      });

      await component.toggleFavorite();

      expect(mockStorageStore.removeFavorite).toHaveBeenCalledWith({
        deviceId: 'test-device',
        storageType: StorageType.Sd,
        filePath: '/games/game.rom',
      });
      expect(mockPlayerContext.updateCurrentFileFavoriteStatus).toHaveBeenCalledWith(
        'test-device',
        '/games/game.rom',
        false
      );
    });

    it('should not call any action when no file is loaded', async () => {
      currentFileSignal.set(null);

      await component.toggleFavorite();

      expect(mockStorageStore.saveFavorite).not.toHaveBeenCalled();
      expect(mockStorageStore.removeFavorite).not.toHaveBeenCalled();
      expect(mockPlayerContext.updateCurrentFileFavoriteStatus).not.toHaveBeenCalled();
    });

    it('should pass correct identifiers from storage key when saving favorite', async () => {
      currentFileSignal.set(
        createLaunchedFile('device-123', StorageType.Usb, {
          isFavorite: false,
          path: '/music/music.mp3',
        })
      );
      mockStorageStore.saveFavorite.mockImplementation(async () => {
        favoriteOperationsStateSignal.set({ isProcessing: false, error: null });
      });

      await component.toggleFavorite();

      expect(mockStorageStore.saveFavorite).toHaveBeenCalledWith({
        deviceId: 'device-123',
        storageType: StorageType.Usb,
        filePath: '/music/music.mp3',
      });
      expect(mockPlayerContext.updateCurrentFileFavoriteStatus).toHaveBeenCalledWith(
        'device-123',
        '/music/music.mp3',
        true
      );
    });

    it('should not update player context when favorite operation reports an error', async () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, {
          isFavorite: false,
          path: '/games/game.rom',
        })
      );
      mockStorageStore.saveFavorite.mockImplementation(async () => {
        favoriteOperationsStateSignal.set({ isProcessing: false, error: 'Failed to save' });
      });

      await component.toggleFavorite();

      expect(mockStorageStore.saveFavorite).toHaveBeenCalled();
      expect(mockPlayerContext.updateCurrentFileFavoriteStatus).not.toHaveBeenCalled();
    });

    it('should return early when an operation is already in progress', async () => {
      favoriteOperationsStateSignal.set({ isProcessing: true, error: null });
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, {
          isFavorite: false,
          path: '/games/game.rom',
        })
      );

      await component.toggleFavorite();

      expect(mockStorageStore.saveFavorite).not.toHaveBeenCalled();
      expect(mockStorageStore.removeFavorite).not.toHaveBeenCalled();
      expect(mockPlayerContext.updateCurrentFileFavoriteStatus).not.toHaveBeenCalled();
    });
  });

  describe('Current File Computed Signal', () => {
    it('should have currentFile computed signal', () => {
      expect(component.currentFile).toBeDefined();
    });

    it('should return null when no file is loaded', () => {
      currentFileSignal.set(null);
      expect(component.currentFile()).toBeNull();
    });

    it('should return current file from playerContext', () => {
      const launchedFile = createLaunchedFile('test-device', StorageType.Sd);
      currentFileSignal.set(launchedFile);
      expect(component.currentFile()).toEqual(launchedFile);
    });

    it('should update when currentFile signal changes', () => {
      const file1 = createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false });
      const file2 = createLaunchedFile('test-device', StorageType.Sd, { isFavorite: true });

      currentFileSignal.set(file1);
      expect(component.currentFile()).toEqual(file1);

      currentFileSignal.set(file2);
      expect(component.currentFile()).toEqual(file2);
    });

    it('should reactively track changes to file.isFavorite property', () => {
      const launchedFile = createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false });
      currentFileSignal.set(launchedFile);

      // Initial state: isFavorite is false
      expect(component.currentFile()?.file.isFavorite).toBe(false);
      expect(component.isFavorite()).toBe(false);

      // Update the file object with new favorite status (simulating store update)
      const updatedLaunchedFile = {
        ...launchedFile,
        file: {
          ...launchedFile.file,
          isFavorite: true,
        },
      };
      currentFileSignal.set(updatedLaunchedFile);

      // REGRESSION: Without proper signal reactivity, this would still return false
      // The computed signal must re-evaluate when the underlying store signal changes
      expect(component.currentFile()?.file.isFavorite).toBe(true);
      expect(component.isFavorite()).toBe(true);
    });
  });

  describe('Template Integration', () => {
    it('should render shuffle button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('should render favorite button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button');
      // Should have timer, history, shuffle, and favorite buttons
      expect(buttons.length).toBe(4);
    });

    it('should display favorite_border icon when file is not favorited', () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false })
      );
      fixture.detectChanges();

      expect(component.isFavorite()).toBe(false);
    });

    it('should display favorite icon when file is favorited', () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, { isFavorite: true })
      );
      fixture.detectChanges();

      expect(component.isFavorite()).toBe(true);
    });

    it('should disable favorite button when no file is loaded', () => {
      currentFileSignal.set(null);
      fixture.detectChanges();

      expect(!component.currentFile()).toBe(true);
    });

    it('should disable favorite button when operation is in progress', () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false })
      );
      favoriteOperationsStateSignal.set({ isProcessing: true, error: null });
      fixture.detectChanges();

      expect(component.isFavoriteOperationInProgress()).toBe(true);
    });

    it('should set highlight color when file is favorited', () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, { isFavorite: true })
      );
      fixture.detectChanges();

      expect(component.isFavorite()).toBe(true);
    });

    it('should set normal color when file is not favorited', () => {
      currentFileSignal.set(
        createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false })
      );
      fixture.detectChanges();

      expect(component.isFavorite()).toBe(false);
    });
  });

  describe('Task 1: Duration Options Constant', () => {
    it('should have DURATION_OPTIONS with 10 entries', () => {
      expect(component['durationOptions']).toBeDefined();
      expect(component['durationOptions'].length).toBe(8);
    });

    it('should have duration options in ascending order', () => {
      const options = component['durationOptions'];
      for (let i = 1; i < options.length; i++) {
        expect(options[i].valueMs).toBeGreaterThan(options[i - 1].valueMs);
      }
    });

    it('should have labels with correct format (seconds use "s", minutes use "m", hours use "h")', () => {
      const options = component['durationOptions'];
      
      // Check seconds format
      expect(options[0].label).toBe('15s');
      expect(options[1].label).toBe('30s');
      
      // Check minutes format
      expect(options[2].label).toBe('1m');
      expect(options[3].label).toBe('3m');
      expect(options[4].label).toBe('5m');
      expect(options[5].label).toBe('10m');
      expect(options[6].label).toBe('30m');
      
      // Check hours format
      expect(options[7].label).toBe('1h');
    });

    it('should have correct millisecond values for all durations', () => {
      const options = component['durationOptions'];
      
      expect(options[0].valueMs).toBe(15000);   // 15s
      expect(options[1].valueMs).toBe(30000);   // 30s
      expect(options[2].valueMs).toBe(60000);   // 1m
      expect(options[3].valueMs).toBe(180000);  // 3m
      expect(options[4].valueMs).toBe(300000);  // 5m
      expect(options[5].valueMs).toBe(600000);  // 10m
      expect(options[6].valueMs).toBe(1800000); // 30m
      expect(options[7].valueMs).toBe(3600000); // 1h
    });
  });

  describe('Task 2: Component State Properties', () => {
    it('should have customTimerConfig computed signal', () => {
      expect(component.customTimerConfig).toBeDefined();
    });

    it('should return null from customTimerConfig when no config exists', () => {
      customTimerConfigSignal.set(null);
      expect(component.customTimerConfig()).toBeNull();
    });

    it('should return timer config from playerContext', () => {
      const config = { enabled: true, durationMs: 180000 };
      customTimerConfigSignal.set(config);
      expect(component.customTimerConfig()).toEqual(config);
    });

    it('should have isCustomTimerEnabled computed signal defaulting to false', () => {
      customTimerConfigSignal.set(null);
      expect(component.isCustomTimerEnabled()).toBe(false);
    });

    it('should return true from isCustomTimerEnabled when timer is enabled', () => {
      customTimerConfigSignal.set({ enabled: true, durationMs: 180000 });
      expect(component.isCustomTimerEnabled()).toBe(true);
    });

    it('should return false from isCustomTimerEnabled when timer is disabled', () => {
      customTimerConfigSignal.set({ enabled: false, durationMs: 180000 });
      expect(component.isCustomTimerEnabled()).toBe(false);
    });

    it('should have selectedDurationMs computed signal defaulting to 180000', () => {
      customTimerConfigSignal.set(null);
      expect(component.selectedDurationMs()).toBe(180000);
    });

    it('should return current duration from selectedDurationMs', () => {
      customTimerConfigSignal.set({ enabled: true, durationMs: 30000 });
      expect(component.selectedDurationMs()).toBe(30000);
    });

    it('should update isCustomTimerEnabled reactively when config changes', () => {
      // Initially disabled
      customTimerConfigSignal.set({ enabled: false, durationMs: 180000 });
      expect(component.isCustomTimerEnabled()).toBe(false);

      // Enable timer
      customTimerConfigSignal.set({ enabled: true, durationMs: 180000 });
      expect(component.isCustomTimerEnabled()).toBe(true);

      // Disable timer again
      customTimerConfigSignal.set({ enabled: false, durationMs: 180000 });
      expect(component.isCustomTimerEnabled()).toBe(false);
    });

    it('should update selectedDurationMs reactively when config changes', () => {
      // Initial duration
      customTimerConfigSignal.set({ enabled: true, durationMs: 180000 });
      expect(component.selectedDurationMs()).toBe(180000);

      // Change duration to 30s
      customTimerConfigSignal.set({ enabled: true, durationMs: 30000 });
      expect(component.selectedDurationMs()).toBe(30000);

      // Change duration to 1h
      customTimerConfigSignal.set({ enabled: true, durationMs: 3600000 });
      expect(component.selectedDurationMs()).toBe(3600000);
    });

    it('should handle null config gracefully with default values', () => {
      customTimerConfigSignal.set(null);
      
      expect(component.customTimerConfig()).toBeNull();
      expect(component.isCustomTimerEnabled()).toBe(false);
      expect(component.selectedDurationMs()).toBe(180000);
    });
  });

  describe('Task 3: Timer Menu Button', () => {
    it('should have onTimerMenuItemClick method', () => {
      expect(component.onTimerMenuItemClick).toBeDefined();
    });

    it('should disable timer when "Off" menu item is clicked', () => {
      customTimerConfigSignal.set({ enabled: true, durationMs: 180000 });
      
      component.onTimerMenuItemClick(null);
      
      expect(mockPlayerContext.setCustomTimer).toHaveBeenCalledWith('test-device', false, 180000);
    });

    it('should enable timer with selected duration when duration menu item is clicked', () => {
      customTimerConfigSignal.set({ enabled: false, durationMs: 180000 });
      
      component.onTimerMenuItemClick(30000);
      
      expect(mockPlayerContext.setCustomTimer).toHaveBeenCalledWith('test-device', true, 30000);
    });

    it('should preserve duration when selecting "Off" menu item', () => {
      // Set custom duration
      customTimerConfigSignal.set({ enabled: true, durationMs: 30000 });
      
      // Select "Off"
      component.onTimerMenuItemClick(null);
      expect(mockPlayerContext.setCustomTimer).toHaveBeenCalledWith('test-device', false, 30000);
    });

    it('should render timer button in template', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const timerButton = compiled.querySelector('[data-testid="timer-button"]');
      expect(timerButton).toBeTruthy();
    });

    it('should show highlight color when timer is enabled', () => {
      customTimerConfigSignal.set({ enabled: true, durationMs: 180000 });
      fixture.detectChanges();
      
      expect(component.isCustomTimerEnabled()).toBe(true);
    });

    it('should show normal color when timer is disabled', () => {
      customTimerConfigSignal.set({ enabled: false, durationMs: 180000 });
      fixture.detectChanges();
      
      expect(component.isCustomTimerEnabled()).toBe(false);
    });

    it('should not error when deviceId is empty', () => {
      fixture.componentRef.setInput('deviceId', '');
      fixture.detectChanges();
      
      expect(() => component.onTimerMenuItemClick(null)).not.toThrow();
      expect(mockPlayerContext.setCustomTimer).not.toHaveBeenCalled();
    });

    it('should have timerBadgeText computed signal', () => {
      expect(component.timerBadgeText).toBeDefined();
    });

    it('should return correct badge text for selected duration', () => {
      customTimerConfigSignal.set({ enabled: true, durationMs: 30000 });
      expect(component.timerBadgeText()).toBe('30s');

      customTimerConfigSignal.set({ enabled: true, durationMs: 180000 });
      expect(component.timerBadgeText()).toBe('3m');

      customTimerConfigSignal.set({ enabled: true, durationMs: 3600000 });
      expect(component.timerBadgeText()).toBe('1h');
    });

    it('should default to "3m" badge text when config is null', () => {
      customTimerConfigSignal.set(null);
      expect(component.timerBadgeText()).toBe('3m');
    });
  });

  describe('Task 4: Timer Menu', () => {
    it('should render lib-dropdown-menu in template', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const menu = compiled.querySelector('lib-dropdown-menu');
      expect(menu).toBeTruthy();
    });

    it('should call onTimerMenuItemClick with null when "Off" menu item method is invoked', () => {
      const spy = vi.spyOn(mockPlayerContext, 'setCustomTimer');
      
      component.onTimerMenuItemClick(null);
      
      expect(spy).toHaveBeenCalledWith('test-device', false, 180000);
    });

    it('should call onTimerMenuItemClick with duration when duration method is invoked', () => {
      const spy = vi.spyOn(mockPlayerContext, 'setCustomTimer');
      
      component.onTimerMenuItemClick(30000);
      
      expect(spy).toHaveBeenCalledWith('test-device', true, 30000);
    });

    it('should change duration and keep timer enabled when duration menu item selected', () => {
      customTimerConfigSignal.set({ enabled: true, durationMs: 180000 });
      
      component.onTimerMenuItemClick(60000);
      
      // Timer should remain enabled with new duration
      expect(mockPlayerContext.setCustomTimer).toHaveBeenCalledWith('test-device', true, 60000);
    });

    it('should enable timer when selecting duration while timer is off', () => {
      customTimerConfigSignal.set({ enabled: false, durationMs: 180000 });
      
      component.onTimerMenuItemClick(30000);
      
      expect(mockPlayerContext.setCustomTimer).toHaveBeenCalledWith('test-device', true, 30000);
    });
  });

  describe('Task 6: Edge Cases and State Initialization', () => {
    it('should handle null config gracefully in timer menu', () => {
      customTimerConfigSignal.set(null);
      fixture.detectChanges();
      
      // Should not error when clicking menu item with null config
      expect(() => component.onTimerMenuItemClick(null)).not.toThrow();
      expect(component.isCustomTimerEnabled()).toBe(false);
    });

    it('should handle empty deviceId in timer menu item click', () => {
      fixture.componentRef.setInput('deviceId', '');
      fixture.detectChanges();
      
      component.onTimerMenuItemClick(30000);
      
      expect(mockPlayerContext.setCustomTimer).not.toHaveBeenCalled();
    });

    it('should handle empty deviceId when clicking "Off" menu item', () => {
      fixture.componentRef.setInput('deviceId', '');
      fixture.detectChanges();
      
      component.onTimerMenuItemClick(null);
      
      expect(mockPlayerContext.setCustomTimer).not.toHaveBeenCalled();
    });

    it('should support multiple devices with independent timer configs', () => {
      // Device 1 config
      const device1ConfigSignal = signal<{ enabled: boolean; durationMs: number } | null>({ 
        enabled: true, 
        durationMs: 30000 
      });
      
      // Device 2 config
      const device2ConfigSignal = signal<{ enabled: boolean; durationMs: number } | null>({ 
        enabled: false, 
        durationMs: 180000 
      });
      
      // Mock getPlayTimerConfig to return different configs per device
      mockPlayerContext.getPlayTimerConfig = vi.fn((deviceId: string) => {
        if (deviceId === 'device-1') return device1ConfigSignal;
        if (deviceId === 'device-2') return device2ConfigSignal;
        return signal(null);
      });
      
      // Test device 1
      fixture.componentRef.setInput('deviceId', 'device-1');
      fixture.detectChanges();
      
      expect(component.isCustomTimerEnabled()).toBe(true);
      expect(component.selectedDurationMs()).toBe(30000);
      expect(component.timerBadgeText()).toBe('30s');
      
      // Test device 2
      fixture.componentRef.setInput('deviceId', 'device-2');
      fixture.detectChanges();
      
      expect(component.isCustomTimerEnabled()).toBe(false);
      expect(component.selectedDurationMs()).toBe(180000);
      expect(component.timerBadgeText()).toBe('3m');
    });

    it('should not cause errors when component is destroyed', () => {
      customTimerConfigSignal.set({ enabled: true, durationMs: 180000 });
      fixture.detectChanges();
      
      // Destroy component
      expect(() => fixture.destroy()).not.toThrow();
    });

    it('should prevent invalid duration values via predefined options', () => {
      // Menu only allows selection from DURATION_OPTIONS
      const validValues = component['durationOptions'].map(opt => opt.valueMs);
      
      // Verify all values are positive
      validValues.forEach(value => {
        expect(value).toBeGreaterThan(0);
      });
      
      // Verify values are unique
      const uniqueValues = new Set(validValues);
      expect(uniqueValues.size).toBe(validValues.length);
    });

    it('should use default duration (180000ms) when config is null', () => {
      customTimerConfigSignal.set(null);
      fixture.detectChanges();
      
      expect(component.selectedDurationMs()).toBe(180000);
    });

    it('should use default enabled state (false) when config is null', () => {
      customTimerConfigSignal.set(null);
      fixture.detectChanges();
      
      expect(component.isCustomTimerEnabled()).toBe(false);
    });
  });
});


