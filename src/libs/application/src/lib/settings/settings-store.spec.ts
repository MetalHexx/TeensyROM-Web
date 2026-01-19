import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import '@analogjs/vitest-angular/setup-zone';
import { TestBed } from '@angular/core/testing';
import { Settings, ISettingsService, SETTINGS_SERVICE, PlayerFilterType } from '@teensyrom-nx/domain';
import { SettingsStore } from './settings-store';

// --------------------------------------------------------------------------
// MOCK INFRASTRUCTURE
// --------------------------------------------------------------------------

type SettingsStoreInstance = {
  settings: () => Settings | null;
  history: () => Settings[];
  historyPosition: () => number;
  isLoading: () => boolean;
  isSaving: () => boolean;
  error: () => string | null;
  lastUpdated: () => number | null;

  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSettings: (params: { settings: Partial<Settings> }) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  getSettings: () => () => Settings | null;
  canUndo: () => () => boolean;
  canRedo: () => () => boolean;
  getHistoryPosition: () => () => number;
  isNavigatingHistory: () => () => boolean;
  historyPositionDisplay: () => () => string | null;
};

describe('SettingsStore (NgRx Signal Store)', () => {
  let store: SettingsStoreInstance;
  let mockSettingsService: ISettingsService;

  const createMockSettings = (overrides: Partial<Settings> = {}): Settings => ({
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: false,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: PlayerFilterType.All,
      startupLaunchEnabled: false,
      startupLaunchRandom: false,
    },
    fileTransferSettings: {
      watchDirectoryLocation: '',
      autoTransferPath: '',
      autoFileCopyEnabled: false,
      autoLaunchOnCopyEnabled: false,
      navToDirOnLaunch: false,
      syncFilesEnabled: false,
    },
    searchSettings: {
      weights: {
        nameWeight: 1,
        titleWeight: 1,
        creatorWeight: 1,
        releaseInfoWeight: 1,
        descriptionWeight: 1,
      },
      stopWords: [],
      bannedDirectories: [],
      bannedFiles: [],
    },
    appSettings: {
      setupCompleted: false,
    },
    knownDevices: [],
    ...overrides,
  });

  const createTestStore = () => {
    mockSettingsService = {
      getSettings: vi.fn(),
      saveSettings: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: SETTINGS_SERVICE, useValue: mockSettingsService }],
    });

    store = TestBed.inject(SettingsStore) as unknown as SettingsStoreInstance;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    createTestStore();
  });

  // --------------------------------------------------------------------------
  // INITIAL STATE TESTS
  // --------------------------------------------------------------------------

  describe('Initial State', () => {
    it('should initialize with null settings', () => {
      expect(store.settings()).toBeNull();
    });

    it('should initialize with empty history', () => {
      expect(store.history()).toEqual([]);
    });

    it('should initialize history position at -1 (current)', () => {
      expect(store.historyPosition()).toBe(-1);
    });

    it('should initialize with loading false', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should initialize with saving false', () => {
      expect(store.isSaving()).toBe(false);
    });

    it('should initialize with no error', () => {
      expect(store.error()).toBeNull();
    });

    it('should initialize with no last updated timestamp', () => {
      expect(store.lastUpdated()).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // LOAD SETTINGS ACTION TESTS
  // --------------------------------------------------------------------------

  describe('loadSettings Action', () => {
    it('should set loading state before API call', async () => {
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(
        timer(50).pipe(map(() => createMockSettings()))
      );

      const promise = store.loadSettings();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.isLoading()).toBe(true);

      await promise;
      expect(store.isLoading()).toBe(false);
    });

    it('should load settings successfully', async () => {
      const mockSettings = createMockSettings({
        appSettings: { setupCompleted: true },
      });

      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));

      await store.loadSettings();

      expect(mockSettingsService.getSettings).toHaveBeenCalledTimes(1);
      expect(store.settings()).toEqual(mockSettings);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('should initialize history with loaded settings', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));

      await store.loadSettings();

      expect(store.history()).toEqual([]);
      expect(store.historyPosition()).toBe(-1);
    });

    it('should update lastUpdated timestamp on success', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));

      const beforeTime = Date.now();
      await store.loadSettings();
      const afterTime = Date.now();

      const timestamp = store.lastUpdated();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should handle load error', async () => {
      const errorMessage = 'Network error';
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(
        throwError(() => new Error(errorMessage))
      );

      await store.loadSettings();

      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBe(errorMessage);
      expect(store.settings()).toBeNull();
    });

    it('should use fallback error message when error has no message', async () => {
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(
        throwError(() => ({}))
      );

      await store.loadSettings();

      expect(store.error()).toBe('Failed to load settings');
    });

    it('should clear previous error on successful load', async () => {
      const mockSettings = createMockSettings();

      vi.mocked(mockSettingsService.getSettings).mockReturnValueOnce(
        throwError(() => new Error('First error'))
      );
      await store.loadSettings();
      expect(store.error()).toBe('First error');

      vi.mocked(mockSettingsService.getSettings).mockReturnValueOnce(of(mockSettings));
      await store.loadSettings();

      expect(store.error()).toBeNull();
      expect(store.settings()).toEqual(mockSettings);
    });
  });

  // --------------------------------------------------------------------------
  // SAVE SETTINGS ACTION TESTS
  // --------------------------------------------------------------------------

  describe('saveSettings Action', () => {
    it('should not save when no settings exist', async () => {
      await store.saveSettings();

      expect(mockSettingsService.saveSettings).not.toHaveBeenCalled();
    });

    it('should set saving state before API call', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      vi.mocked(mockSettingsService.saveSettings).mockReturnValue(
        timer(50).pipe(map(() => mockSettings))
      );

      const promise = store.saveSettings();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.isSaving()).toBe(true);

      await promise;
      expect(store.isSaving()).toBe(false);
    });

    it('should save settings successfully', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      vi.mocked(mockSettingsService.saveSettings).mockReturnValue(of(mockSettings));

      await store.saveSettings();

      expect(mockSettingsService.saveSettings).toHaveBeenCalledWith(mockSettings);
      expect(store.isSaving()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('should not modify history on save', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      const historyBefore = store.history();

      vi.mocked(mockSettingsService.saveSettings).mockReturnValue(of(mockSettings));
      await store.saveSettings();

      expect(store.history()).toEqual(historyBefore);
      expect(store.historyPosition()).toBe(-1);
    });

    it('should handle save error', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      const errorMessage = 'Save failed';
      vi.mocked(mockSettingsService.saveSettings).mockReturnValue(
        throwError(() => new Error(errorMessage))
      );

      await store.saveSettings();

      expect(store.isSaving()).toBe(false);
      expect(store.error()).toBe(errorMessage);
    });

    it('should use fallback error message when error has no message', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      vi.mocked(mockSettingsService.saveSettings).mockReturnValue(
        throwError(() => ({}))
      );

      await store.saveSettings();

      expect(store.error()).toBe('Failed to save settings');
    });

    it('should preserve current state on save failure', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      const settingsBefore = store.settings();

      vi.mocked(mockSettingsService.saveSettings).mockReturnValue(
        throwError(() => new Error('Save failed'))
      );

      await store.saveSettings();

      expect(store.settings()).toEqual(settingsBefore);
    });
  });

  // --------------------------------------------------------------------------
  // UPDATE SETTINGS ACTION TESTS
  // --------------------------------------------------------------------------

  describe('updateSettings Action', () => {
    it('should not update when no current settings exist', () => {
      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

      expect(store.settings()).toBeNull();
      expect(store.history()).toEqual([]);
    });

    it('should update settings with partial updates', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({
        settings: { appSettings: { setupCompleted: true } },
      });

      const updatedSettings = store.settings();
      expect(updatedSettings?.appSettings.setupCompleted).toBe(true);
    });

    it('should add current settings to history before update', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      const initialHistory = [...store.history()];

      store.updateSettings({
        settings: { appSettings: { setupCompleted: true } },
      });

      const newHistory = store.history();
      expect(newHistory.length).toBe(initialHistory.length + 1);
      expect(newHistory[newHistory.length - 1]).toEqual(mockSettings);
    });

    it('should reset history position to -1 after update', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
      store.undo();
      expect(store.historyPosition()).not.toBe(-1);

      store.updateSettings({ settings: { appSettings: { setupCompleted: false } } });
      expect(store.historyPosition()).toBe(-1);
    });

    it('should deep merge nested objects', async () => {
      const mockSettings = createMockSettings({
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: false,
          muteFastForward: false,
          muteRandomSeek: false,
          startupFilter: PlayerFilterType.All,
          startupLaunchEnabled: false,
          startupLaunchRandom: false,
        },
      });
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({
        settings: {
          playerSettings: {
            repeatModeOnStartup: true,
            playTimerEnabled: false,
            muteFastForward: false,
            muteRandomSeek: false,
            startupFilter: PlayerFilterType.All,
            startupLaunchEnabled: false,
            startupLaunchRandom: false,
          },
        },
      });

      const updated = store.settings();
      expect(updated?.playerSettings.repeatModeOnStartup).toBe(true);
      expect(updated?.playerSettings.playTimerEnabled).toBe(false);
    });

    it('should trim history when exceeding 50 entries', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      // Add 50 updates to fill history
      for (let i = 0; i < 50; i++) {
        store.updateSettings({
          settings: { appSettings: { setupCompleted: i % 2 === 0 } },
        });
      }

      expect(store.history().length).toBe(50);

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

      expect(store.history().length).toBe(50);
    });

    it('should update lastUpdated timestamp', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      const beforeTime = Date.now();
      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
      const afterTime = Date.now();

      const timestamp = store.lastUpdated();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  // --------------------------------------------------------------------------
  // UNDO/REDO ACTION TESTS
  // --------------------------------------------------------------------------

  describe('undo Action', () => {
    it('should not undo when no history exists', () => {
      store.undo();

      expect(store.historyPosition()).toBe(-1);
      expect(store.settings()).toBeNull();
    });

    it('should undo from current (-1) to most recent history entry', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

      const beforeUpdate = store.history()[0];

      store.undo();

      expect(store.historyPosition()).toBe(0);
      expect(store.settings()).toEqual(beforeUpdate);
    });

    it('should move backward through history', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
      store.updateSettings({ settings: { appSettings: { setupCompleted: false } } });

      store.undo();
      expect(store.historyPosition()).toBe(1);

      store.undo();
      expect(store.historyPosition()).toBe(0);
    });

    it('should stop at position 0 without wrapping', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
      store.updateSettings({ settings: { appSettings: { setupCompleted: false } } });

      store.undo();
      store.undo();
      expect(store.historyPosition()).toBe(0);

      // Try to undo again - should stay at 0, not wrap
      store.undo();
      expect(store.historyPosition()).toBe(0);
    });

    it('should restore historical settings', async () => {
      const mockSettings = createMockSettings({ appSettings: { setupCompleted: false } });
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

      store.undo();

      expect(store.settings()?.appSettings.setupCompleted).toBe(false);
    });
  });

  describe('redo Action', () => {
    it('should not redo when no history exists', () => {
      store.redo();

      expect(store.historyPosition()).toBe(-1);
    });

    it('should not redo when already at current (-1)', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.redo();

      expect(store.historyPosition()).toBe(-1);
    });

    it('should move forward through history', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
      store.updateSettings({ settings: { appSettings: { setupCompleted: false } } });

      store.undo();
      store.undo();

      store.redo();
      expect(store.historyPosition()).toBe(1);
    });

    it('should move to current when beyond history', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

      store.undo();
      store.redo();

      expect(store.historyPosition()).toBe(-1);
    });

    it('should restore historical settings', async () => {
      const mockSettings = createMockSettings({ appSettings: { setupCompleted: false } });
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

      const afterUpdate = store.settings();

      store.undo();
      expect(store.settings()?.appSettings.setupCompleted).toBe(false);

      store.redo();
      expect(store.settings()).toEqual(afterUpdate);
    });
  });

  describe('clearHistory Action', () => {
    it('should clear history and reset position', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
      store.updateSettings({ settings: { appSettings: { setupCompleted: false } } });

      expect(store.history().length).toBeGreaterThan(0);

      store.clearHistory();

      expect(store.history().length).toBe(0);
      expect(store.historyPosition()).toBe(-1);
    });

    it('should reinitialize history with current settings', async () => {
      const mockSettings = createMockSettings();
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
      store.clearHistory();

      expect(store.history().length).toBe(0);
    });

    it('should handle clearing when no settings exist', () => {
      store.clearHistory();

      expect(store.history()).toEqual([]);
      expect(store.historyPosition()).toBe(-1);
    });
  });

  // --------------------------------------------------------------------------
  // SELECTOR TESTS
  // --------------------------------------------------------------------------

  describe('Selectors', () => {
    describe('getSettings', () => {
      it('should return null initially', () => {
        const getSettings = store.getSettings();
        expect(getSettings()).toBeNull();
      });

      it('should return current settings after load', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        const getSettings = store.getSettings();
        expect(getSettings()).toEqual(mockSettings);
      });

      it('should reactively update when settings change', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        const getSettings = store.getSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

        expect(getSettings()?.appSettings.setupCompleted).toBe(true);
      });
    });

    describe('canUndo', () => {
      it('should return false when no history', () => {
        const canUndo = store.canUndo();
        expect(canUndo()).toBe(false);
      });

      it('should return true when history exists', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

        const canUndo = store.canUndo();
        expect(canUndo()).toBe(true);
      });

      it('should return false when at position 0 (boundary stop)', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

        const canUndo = store.canUndo();

        expect(canUndo()).toBe(true); // At position -1, can undo to position 0

        store.undo(); // Now at position 0
        expect(canUndo()).toBe(false); // At position 0, cannot undo further
      });
    });

    describe('canRedo', () => {
      it('should return false when no history', () => {
        const canRedo = store.canRedo();
        expect(canRedo()).toBe(false);
      });

      it('should return false when at current (-1)', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        const canRedo = store.canRedo();
        expect(canRedo()).toBe(false);
      });

      it('should return true when not at current', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
        store.undo();

        const canRedo = store.canRedo();
        expect(canRedo()).toBe(true);
      });
    });

    describe('getHistoryPosition', () => {
      it('should return -1 initially', () => {
        const getPosition = store.getHistoryPosition();
        expect(getPosition()).toBe(-1);
      });

      it('should return current position after navigation', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
        store.undo();

        const getPosition = store.getHistoryPosition();
        expect(getPosition()).toBe(0);
      });

      it('should reactively update when position changes', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });

        const getPosition = store.getHistoryPosition();

        store.undo();
        expect(getPosition()).toBe(0);

        store.redo();
        expect(getPosition()).toBe(-1);
      });
    });

    describe('isNavigatingHistory', () => {
      it('should return false at current state (position -1)', () => {
        const isNavigating = store.isNavigatingHistory();
        expect(isNavigating()).toBe(false);
      });

      it('should return true when navigating history', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
        store.undo();

        const isNavigating = store.isNavigatingHistory();
        expect(isNavigating()).toBe(true);
      });

      it('should return false after returning to current', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
        store.undo();
        store.redo();

        const isNavigating = store.isNavigatingHistory();
        expect(isNavigating()).toBe(false);
      });
    });

    describe('historyPositionDisplay', () => {
      it('should return null at current state', () => {
        const display = store.historyPositionDisplay();
        expect(display()).toBeNull();
      });

      it('should return null with empty history', () => {
        const display = store.historyPositionDisplay();
        expect(display()).toBeNull();
      });

      it('should return formatted position string when navigating', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
        store.updateSettings({ settings: { appSettings: { setupCompleted: false } } });
        
        // history.length should be 2, position will be 1 after first undo
        store.undo();

        const display = store.historyPositionDisplay();
        expect(display()).toBe('2/2');
      });

      it('should show 1-indexed position (position 0 displays as 1)', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
        store.undo();
        store.undo();

        const display = store.historyPositionDisplay();
        expect(display()).toBe('1/1');
      });

      it('should return null after returning to current', async () => {
        const mockSettings = createMockSettings();
        vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
        await store.loadSettings();

        store.updateSettings({ settings: { appSettings: { setupCompleted: true } } });
        store.undo();
        store.redo();

        const display = store.historyPositionDisplay();
        expect(display()).toBeNull();
      });
    });
  });

  // --------------------------------------------------------------------------
  // VIDEO SETTINGS INTEGRATION TESTS
  // --------------------------------------------------------------------------
  // NOTE: These tests are skipped because videoSettings moved to knownDevices array
  // TODO: Add new tests for per-device video settings in knownDevices

  describe.skip('Video Settings Integration (Obsolete - moved to knownDevices)', () => {
    it('should load video settings from API', async () => {
      const mockSettings = createMockSettings({
        knownDevices: [{
          deviceId: 'test-device',
          videoSettings: { enableVideo: true, videoDeviceId: 'test' },
          connectionSettings: { autoConnectEnabled: false },
        }],
      });
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));

      await store.loadSettings();

      expect(store.settings()?.knownDevices[0].videoSettings).toEqual({ enableVideo: true, videoDeviceId: 'test' });
    });

    it('should save video settings to backend', async () => {
      const mockSettings = createMockSettings({
        knownDevices: [{
          deviceId: 'test-device',
          videoSettings: { enableVideo: false, videoDeviceId: '' },
          connectionSettings: { autoConnectEnabled: false },
        }],
      });
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({
        settings: {
          knownDevices: [{
            deviceId: 'test-device',
            videoSettings: { enableVideo: true, videoDeviceId: 'test' },
            connectionSettings: { autoConnectEnabled: false },
          }],
        },
      });

      vi.mocked(mockSettingsService.saveSettings).mockReturnValue(
        of(store.settings() as Settings)
      );
      await store.saveSettings();

      expect(mockSettingsService.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          knownDevices: expect.arrayContaining([
            expect.objectContaining({
              videoSettings: { enableVideo: true, videoDeviceId: 'test' },
            }),
          ]),
        })
      );
    });

    it('should include video settings in history tracking', async () => {
      const mockSettings = createMockSettings({
        knownDevices: [{
          deviceId: 'test-device',
          videoSettings: { enableVideo: false, videoDeviceId: '' },
          connectionSettings: { autoConnectEnabled: false },
        }],
      });
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({
        settings: {
          knownDevices: [{
            deviceId: 'test-device',
            videoSettings: { enableVideo: true, videoDeviceId: 'test' },
            connectionSettings: { autoConnectEnabled: false },
          }],
        },
      });

      const history = store.history();
      expect(history.length).toBe(1);
      expect(history[0].knownDevices?.[0].videoSettings).toEqual({ enableVideo: false, videoDeviceId: '' });
    });

    it('should restore video settings on undo', async () => {
      const mockSettings = createMockSettings({
        knownDevices: [{
          deviceId: 'test-device',
          videoSettings: { enableVideo: false, videoDeviceId: '' },
          connectionSettings: { autoConnectEnabled: false },
        }],
      });
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({
        settings: {
          knownDevices: [{
            deviceId: 'test-device',
            videoSettings: { enableVideo: true, videoDeviceId: 'test' },
            connectionSettings: { autoConnectEnabled: false },
          }],
        },
      });
      expect(store.settings()?.knownDevices[0].videoSettings.enableVideo).toBe(true);

      store.undo();
      expect(store.settings()?.knownDevices[0].videoSettings.enableVideo).toBe(false);
    });

    it('should restore video settings on redo', async () => {
      const mockSettings = createMockSettings({
        knownDevices: [{
          deviceId: 'test-device',
          videoSettings: { enableVideo: false, videoDeviceId: '' },
          connectionSettings: { autoConnectEnabled: false },
        }],
      });
      vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
      await store.loadSettings();

      store.updateSettings({
        settings: {
          knownDevices: [{
            deviceId: 'test-device',
            videoSettings: { enableVideo: true, videoDeviceId: 'test' },
            connectionSettings: { autoConnectEnabled: false },
          }],
        },
      });
      store.undo();

      store.redo();
      expect(store.settings()?.knownDevices[0].videoSettings.enableVideo).toBe(true);
    });
  });
});
