import '@analogjs/vitest-angular/setup-zone';
import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SettingsFormService } from './settings-form.service';
import { Settings, SETTINGS_SERVICE, ISettingsService } from '@teensyrom-nx/domain';
import { SettingsStore } from '@teensyrom-nx/application';

describe('SettingsFormService', () => {
  let service: SettingsFormService;
  let mockSettingsStore: Partial<SettingsStore>;
  let mockSettingsService: ISettingsService;

  // Mock signals
  let settingsSignal: WritableSignal<Settings | null>;
  let isLoadingSignal: WritableSignal<boolean>;
  let isSavingSignal: WritableSignal<boolean>;
  let errorSignal: WritableSignal<string | null>;
  let historySignal: WritableSignal<Settings[]>;
  let historyPositionSignal: WritableSignal<number>;

  const mockSettings: Settings = {
    connectionSettings: {
      connectionType: 'Serial',
      autoConnectEnabled: true,
    },
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: true,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: 'All',
      startupLaunchEnabled: false,
      startupLaunchRandom: false,
    },
    fileTransferSettings: {
      watchDirectoryLocation: '',
      autoTransferPath: '/teensyrom/files',
      autoFileCopyEnabled: false,
      autoLaunchOnCopyEnabled: false,
      navToDirOnLaunch: false,
      syncFilesEnabled: false,
    },
    searchSettings: {
      weights: {
        nameWeight: 5,
        titleWeight: 4,
        creatorWeight: 3,
        releaseInfoWeight: 2,
        descriptionWeight: 1,
      },
      stopWords: ['the', 'and', 'or'],
      bannedDirectories: ['/system', '/temp'],
      bannedFiles: ['.DS_Store', 'thumbs.db'],
    },
    appSettings: {
      setupCompleted: true,
    },
  };

  beforeEach(() => {
    // Initialize mock settings service
    mockSettingsService = {
      getSettings: vi.fn().mockResolvedValue(mockSettings),
      saveSettings: vi.fn().mockResolvedValue(undefined),
    } as ISettingsService;

    // Initialize mock signals
    settingsSignal = signal(mockSettings);
    isLoadingSignal = signal(false);
    isSavingSignal = signal(false);
    errorSignal = signal(null);
    historySignal = signal([mockSettings]);
    historyPositionSignal = signal(-1);

    // Create mock store
    mockSettingsStore = {
      settings: settingsSignal.asReadonly(),
      isLoading: isLoadingSignal.asReadonly(),
      isSaving: isSavingSignal.asReadonly(),
      error: errorSignal.asReadonly(),
      history: historySignal.asReadonly(),
      historyPosition: historyPositionSignal.asReadonly(),
      getSettings: () => settingsSignal.asReadonly(),
      saveSettings: vi.fn(),
      updateSettings: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SettingsFormService,
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: SETTINGS_SERVICE, useValue: mockSettingsService },
      ],
    });

    // Create service within injection context
    TestBed.runInInjectionContext(() => {
      service = TestBed.inject(SettingsFormService);
    });

    // Flush effects to trigger form initialization
    TestBed.flushEffects();
  });

  describe('Service Initialization', () => {
    it('should create', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize form when settings load', () => {
      expect(service.settingsForm()).toBeTruthy();
    });

    it('should build nested FormGroups for all sections', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      expect(form.get('connectionSettings')).toBeTruthy();
      expect(form.get('playerSettings')).toBeTruthy();
      expect(form.get('fileTransferSettings')).toBeTruthy();
      expect(form.get('searchSettings')).toBeTruthy();
      expect(form.get('appSettings')).toBeTruthy();
    });

    it('should patch form values from store settings', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      expect(form.get('connectionSettings.connectionType')?.value).toBe('Serial');
      expect(form.get('connectionSettings.autoConnectEnabled')?.value).toBe(true);
      expect(form.get('playerSettings.playTimerEnabled')?.value).toBe(true);
      expect(form.get('appSettings.setupCompleted')?.value).toBe(true);
    });

    it('should convert array fields to comma-separated strings', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      expect(form.get('searchSettings.stopWords')?.value).toBe('the,and,or');
      expect(form.get('searchSettings.bannedDirectories')?.value).toBe('/system,/temp');
      expect(form.get('searchSettings.bannedFiles')?.value).toBe('.DS_Store,thumbs.db');
    });
  });

  describe('Auto-save', () => {
    it('should default to enabled', () => {
      expect(service.autoSaveEnabled()).toBe(true);
    });

    it('should allow toggling', () => {
      service.autoSaveEnabled.set(false);
      expect(service.autoSaveEnabled()).toBe(false);

      service.autoSaveEnabled.set(true);
      expect(service.autoSaveEnabled()).toBe(true);
    });

    it('should trigger save after 1000ms debounce when enabled', fakeAsync(() => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const saveSpy = vi.spyOn(service, 'saveSettings');

      // Change a value
      form.get('connectionSettings.autoConnectEnabled')?.setValue(false);
      tick(500); // Not enough time

      expect(saveSpy).not.toHaveBeenCalled();

      tick(500); // Total 1000ms

      expect(saveSpy).toHaveBeenCalled();
      flush();
    }));

    it('should not trigger when disabled', fakeAsync(() => {
      service.autoSaveEnabled.set(false);

      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const saveSpy = vi.spyOn(service, 'saveSettings');

      form.get('connectionSettings.autoConnectEnabled')?.setValue(false);
      tick(1000);

      expect(saveSpy).not.toHaveBeenCalled();
      flush();
    }));

    it('should not trigger when form invalid', fakeAsync(() => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const saveSpy = vi.spyOn(service, 'saveSettings');

      // Make form invalid by clearing required field
      form.get('fileTransferSettings.autoTransferPath')?.setValue('');
      tick(1000);

      expect(saveSpy).not.toHaveBeenCalled();
      flush();
    }));
  });

  describe('Manual Save', () => {
    it('should call store updateSettings and saveSettings', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      await service.saveSettings();

      expect(mockSettingsStore.updateSettings).toHaveBeenCalled();
      expect(mockSettingsStore.saveSettings).toHaveBeenCalled();
    });

    it('should convert form values to Settings model', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      form.get('connectionSettings.autoConnectEnabled')?.setValue(false);

      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore.updateSettings).mock.calls[0][0];
      expect(callArg.settings.connectionSettings.autoConnectEnabled).toBe(false);
    });

    it('should convert comma-separated strings to arrays', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      form.get('searchSettings.stopWords')?.setValue('foo, bar, baz');

      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore.updateSettings).mock.calls[0][0];
      expect(callArg.settings.searchSettings.stopWords).toEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('Computed State', () => {
    it('canSave should be true when form valid', () => {
      expect(service.canSave()).toBe(true);
    });

    it('canSave should be false when saving', () => {
      isSavingSignal.set(true);
      expect(service.canSave()).toBe(false);
    });

    it('canUndo should be true when history exists', () => {
      historySignal.set([mockSettings, mockSettings]);
      expect(service.canUndo()).toBe(true);
    });

    it('canUndo should be false when history is empty', () => {
      historySignal.set([]);
      expect(service.canUndo()).toBe(false);
    });

    it('canRedo should be true when not at end of history', () => {
      historySignal.set([mockSettings, mockSettings]);
      historyPositionSignal.set(0);
      expect(service.canRedo()).toBe(true);
    });

    it('canRedo should be false at end of history', () => {
      historySignal.set([mockSettings]);
      historyPositionSignal.set(-1);
      expect(service.canRedo()).toBe(false);
    });
  });

  describe('Undo/Redo', () => {
    it('should call store undo', () => {
      historySignal.set([mockSettings, mockSettings]);
      service.undo();
      expect(mockSettingsStore.undo).toHaveBeenCalled();
    });

    it('should call store redo', () => {
      historySignal.set([mockSettings, mockSettings]);
      historyPositionSignal.set(0);
      service.redo();
      expect(mockSettingsStore.redo).toHaveBeenCalled();
    });

    it('should not undo when history is empty', () => {
      historySignal.set([]);
      service.undo();
      expect(mockSettingsStore.undo).not.toHaveBeenCalled();
    });

    it('should not redo when at end of history', () => {
      historyPositionSignal.set(-1);
      service.redo();
      expect(mockSettingsStore.redo).not.toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    it('getConnectionSettings should return typed FormGroup', () => {
      const formGroup = service.getConnectionSettings();
      expect(formGroup).toBeTruthy();
      expect(formGroup.get('connectionType')).toBeTruthy();
      expect(formGroup.get('autoConnectEnabled')).toBeTruthy();
    });

    it('getPlayerSettings should return typed FormGroup', () => {
      const formGroup = service.getPlayerSettings();
      expect(formGroup).toBeTruthy();
      expect(formGroup.get('repeatModeOnStartup')).toBeTruthy();
    });

    it('getFileTransferSettings should return typed FormGroup', () => {
      const formGroup = service.getFileTransferSettings();
      expect(formGroup).toBeTruthy();
      expect(formGroup.get('autoTransferPath')).toBeTruthy();
    });

    it('getSearchSettings should return typed FormGroup', () => {
      const formGroup = service.getSearchSettings();
      expect(formGroup).toBeTruthy();
      expect(formGroup.get('weights')).toBeTruthy();
    });

    it('getAppSettings should return typed FormGroup', () => {
      const formGroup = service.getAppSettings();
      expect(formGroup).toBeTruthy();
      expect(formGroup.get('setupCompleted')).toBeTruthy();
    });
  });

  describe('Form Sync from Store', () => {
    it('should patch form when settings change in store', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      const newSettings = { ...mockSettings };
      newSettings.connectionSettings.autoConnectEnabled = false;
      historyPositionSignal.set(0); // Simulate undo/redo
      settingsSignal.set(newSettings);
      
      // Flush effects to trigger sync
      TestBed.flushEffects();

      expect(form.get('connectionSettings.autoConnectEnabled')?.value).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate connectionType as required', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const control = form.get('connectionSettings.connectionType');

      control?.setValue('');

      expect(control?.hasError('required')).toBe(true);
    });

    it('should validate search weights with custom validator', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const weights = form.get('searchSettings.weights');

      // Set all weights to 0
      weights?.get('nameWeight')?.setValue(0);
      weights?.get('titleWeight')?.setValue(0);
      weights?.get('creatorWeight')?.setValue(0);
      weights?.get('releaseInfoWeight')?.setValue(0);
      weights?.get('descriptionWeight')?.setValue(0);

      expect(weights?.hasError('atLeastOneWeight')).toBe(true);
    });

    it('should pass weight validation when at least one is greater than 0', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const weights = form.get('searchSettings.weights');

      weights?.get('nameWeight')?.setValue(5);

      expect(weights?.hasError('atLeastOneWeight')).toBe(false);
    });
  });
});
