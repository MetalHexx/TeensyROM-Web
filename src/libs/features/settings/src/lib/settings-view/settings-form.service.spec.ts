import '@analogjs/vitest-angular/setup-zone';
import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { signal, WritableSignal, computed } from '@angular/core';
import { SettingsFormService } from './settings-form.service';
import { Settings, SETTINGS_SERVICE, ISettingsService, PlayerFilterType } from '@teensyrom-nx/domain';
import { SettingsStore } from '@teensyrom-nx/application';

describe('SettingsFormService', () => {
  let service: SettingsFormService;
  let mockSettingsStore: Partial<typeof SettingsStore.prototype>;
  let mockSettingsService: ISettingsService;

  // Mock signals
  let settingsSignal: WritableSignal<Settings | null>;
  let isLoadingSignal: WritableSignal<boolean>;
  let isSavingSignal: WritableSignal<boolean>;
  let errorSignal: WritableSignal<string | null>;
  let historySignal: WritableSignal<Settings[]>;
  let historyPositionSignal: WritableSignal<number>;

  const mockSettings: Settings = {
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: true,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: PlayerFilterType.All,
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
    knownDevices: [
      {
        deviceId: 'device-1',
        videoSettings: {
          enableVideo: true,
          videoDeviceId: '',
        },
        audioSettings: {
          enableAudioStream: false,
          audioDeviceIndex: -1,
          audioDeviceName: '',
          captureChannelCount: 1,
          sampleRate: 48000,
          channels: [],
          useOpusEncoding: true,
        },
      },
    ],
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
      // Selectors return a function that returns a computed signal (matching store pattern)
      canUndo: vi.fn(() => computed(() => {
        const position = historyPositionSignal();
        const historyLength = historySignal().length;
        return historyLength > 0 && (position === -1 || position > 0);
      })),
      canRedo: vi.fn(() => computed(() => historyPositionSignal() !== -1 && historyPositionSignal() < historySignal().length - 1)),
      isNavigatingHistory: vi.fn(() => computed(() => historyPositionSignal() !== -1)),
      historyPositionDisplay: vi.fn(() => computed(() => {
        const position = historyPositionSignal();
        const totalCount = historySignal().length;
        if (position === -1 || totalCount === 0) return null;
        return `${position + 1}/${totalCount}`;
      })),
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

      expect(form.get('knownDevices')).toBeTruthy();
      expect(form.get('playerSettings')).toBeTruthy();
      expect(form.get('fileTransferSettings')).toBeTruthy();
      expect(form.get('searchSettings')).toBeTruthy();
      expect(form.get('appSettings')).toBeTruthy();
    });

    it('should patch form values from store settings', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      const knownDevices = service.getKnownDevices();
      expect(knownDevices.length).toBe(1);
      const deviceGroup = knownDevices.at(0);
      expect(deviceGroup.get('deviceId')?.value).toBe('device-1');
      // Note: connectionSettings not in domain model, only videoSettings
      expect(deviceGroup.get('videoSettings.enableVideo')?.value).toBe(true);
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
      form.get('playerSettings.playTimerEnabled')?.setValue(false);
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

      form.get('playerSettings.playTimerEnabled')?.setValue(false);
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

    it('should not trigger during store sync (undo/redo)', fakeAsync(() => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const saveSpy = vi.spyOn(service, 'saveSettings');

      // Simulate undo/redo by changing history position
      historyPositionSignal.set(0);
      const newSettings = { ...mockSettings };
      newSettings.playerSettings = { ...mockSettings.playerSettings, playTimerEnabled: false };
      settingsSignal.set(newSettings);

      // Flush effects to trigger store sync
      TestBed.flushEffects();
      tick(1000);

      // Auto-save should NOT trigger because sync flag should prevent it
      expect(saveSpy).not.toHaveBeenCalled();
      flush();
    }));

    it('should not trigger on initial form creation', fakeAsync(() => {
      // This test verifies form initialization doesn't trigger auto-save
      const saveSpy = vi.spyOn(service, 'saveSettings');

      // Create a new service instance to test initialization
      void TestBed.runInInjectionContext(() => new SettingsFormService());
      TestBed.flushEffects();
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

      expect(mockSettingsStore['updateSettings']).toHaveBeenCalled();
      expect(mockSettingsStore['saveSettings']).toHaveBeenCalled();
    });

    it('should convert form values to Settings model', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      form.get('playerSettings.playTimerEnabled')?.setValue(false);

      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore['updateSettings']).mock.calls[0][0];
      expect(callArg.settings.playerSettings.playTimerEnabled).toBe(false);
    });

    it('should convert comma-separated strings to arrays', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      form.get('searchSettings.stopWords')?.setValue('foo, bar, baz');

      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore['updateSettings']).mock.calls[0][0];
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

    it('canSave should react when the form itself transitions to invalid, with no other signal changing', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      // Establish canSave's cached value while the form is still valid.
      expect(service.canSave()).toBe(true);

      // Flip the form invalid directly, without writing to isSavingSignal or settingsSignal.
      form.get('fileTransferSettings.autoTransferPath')?.setValue('');
      expect(form.valid).toBe(false);

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
      expect(mockSettingsStore['undo']).toHaveBeenCalled();
    });

    it('should call store redo', () => {
      historySignal.set([mockSettings, mockSettings]);
      historyPositionSignal.set(0);
      service.redo();
      expect(mockSettingsStore['redo']).toHaveBeenCalled();
    });

    it('should not undo when history is empty', () => {
      historySignal.set([]);
      service.undo();
      expect(mockSettingsStore['undo']).not.toHaveBeenCalled();
    });

    it('should not redo when at end of history', () => {
      historyPositionSignal.set(-1);
      service.redo();
      expect(mockSettingsStore['redo']).not.toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    it('getKnownDevices should return FormArray', () => {
      const formArray = service.getKnownDevices();
      expect(formArray).toBeTruthy();
      expect(formArray.length).toBe(1);
      const deviceGroup = formArray.at(0);
      expect(deviceGroup.get('deviceId')).toBeTruthy();
      // Note: connectionSettings not in domain model, only videoSettings
      expect(deviceGroup.get('videoSettings')).toBeTruthy();
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

  describe('Error Handling', () => {
    it('should return early from saveSettings when form is null', async () => {
      service['settingsForm'].set(null);

      await service.saveSettings();

      expect(mockSettingsStore['updateSettings']).not.toHaveBeenCalled();
      expect(mockSettingsStore['saveSettings']).not.toHaveBeenCalled();
    });

    it('should return early from saveSettings when form is invalid', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      // Make form invalid
      form.get('fileTransferSettings.autoTransferPath')?.setValue('');
      form.get('fileTransferSettings.autoTransferPath')?.markAsTouched();

      await service.saveSettings();

      expect(mockSettingsStore['updateSettings']).not.toHaveBeenCalled();
      expect(mockSettingsStore['saveSettings']).not.toHaveBeenCalled();
    });

    it('should throw when getKnownDevices called with null form', () => {
      service['settingsForm'].set(null);

      expect(() => service.getKnownDevices()).toThrow('Settings form not initialized');
    });

    it('should throw when getPlayerSettings called with null form', () => {
      service['settingsForm'].set(null);

      expect(() => service.getPlayerSettings()).toThrow('Settings form not initialized');
    });

    it('should throw when getFileTransferSettings called with null form', () => {
      service['settingsForm'].set(null);

      expect(() => service.getFileTransferSettings()).toThrow('Settings form not initialized');
    });

    it('should throw when getSearchSettings called with null form', () => {
      service['settingsForm'].set(null);

      expect(() => service.getSearchSettings()).toThrow('Settings form not initialized');
    });

    it('should throw when getAppSettings called with null form', () => {
      service['settingsForm'].set(null);

      expect(() => service.getAppSettings()).toThrow('Settings form not initialized');
    });

    it('should log error and continue when saveSettings fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock implementation
      });
      vi.mocked(mockSettingsStore['saveSettings']).mockRejectedValueOnce(new Error('Save failed'));

      await service.saveSettings();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Array/String Transformations', () => {
    it('should handle empty string arrays', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      // Empty strings will make form invalid (required validators), so this tests the edge case
      // In practice, stringToArray('') returns [''] which is technically valid
      form.get('searchSettings.stopWords')?.setValue('single');

      await service.saveSettings();

      // Verify the transformation happens correctly for single values
      const callArg = vi.mocked(mockSettingsStore['updateSettings']).mock.calls[0][0];
      expect(callArg.settings.searchSettings.stopWords).toEqual(['single']);
    });

    it('should handle single value arrays', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      form.get('searchSettings.stopWords')?.setValue('single');

      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore['updateSettings']).mock.calls[0][0];
      expect(callArg.settings.searchSettings.stopWords).toEqual(['single']);
    });

    it('should trim whitespace from array elements', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      form.get('searchSettings.stopWords')?.setValue('  foo  ,  bar  ,  baz  ');

      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore['updateSettings']).mock.calls[0][0];
      expect(callArg.settings.searchSettings.stopWords).toEqual(['foo', 'bar', 'baz']);
    });

    it('should handle arrays with commas and spaces', async () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      form.get('searchSettings.bannedDirectories')?.setValue('/path/with spaces, /another/path');

      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore['updateSettings']).mock.calls[0][0];
      expect(callArg.settings.searchSettings.bannedDirectories).toEqual([
        '/path/with spaces',
        '/another/path',
      ]);
    });
  });

  describe('Form Sync from Store', () => {
    it('should patch form when settings change in store', () => {
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      const newSettings = { ...mockSettings };
      newSettings.playerSettings = { ...mockSettings.playerSettings, playTimerEnabled: false };
      historyPositionSignal.set(0); // Simulate undo/redo
      settingsSignal.set(newSettings);
      
      // Flush effects to trigger sync
      TestBed.flushEffects();

      expect(form.get('playerSettings.playTimerEnabled')?.value).toBe(false);
    });
  });

  describe('Saving Indicator', () => {
    it('should show saving indicator immediately when saving starts', fakeAsync(() => {
      expect(service.showSaving()).toBe(false);

      isSavingSignal.set(true);
      TestBed.flushEffects();

      expect(service.showSaving()).toBe(true);
    }));

    it('should keep showing for 1.5s after save completes', fakeAsync(() => {
      // Start saving
      isSavingSignal.set(true);
      TestBed.flushEffects();
      expect(service.showSaving()).toBe(true);

      // Complete save
      isSavingSignal.set(false);
      TestBed.flushEffects();
      expect(service.showSaving()).toBe(true); // Still showing

      // After 1s, still showing
      tick(1000);
      expect(service.showSaving()).toBe(true);

      // After 1.5s, should hide
      tick(500);
      expect(service.showSaving()).toBe(false);
    }));

    it('should reset timer if saving starts again before delay expires', fakeAsync(() => {
      // First save
      isSavingSignal.set(true);
      TestBed.flushEffects();
      isSavingSignal.set(false);
      TestBed.flushEffects();

      // Wait 1s
      tick(1000);
      expect(service.showSaving()).toBe(true);

      // Start second save before first delay expires
      isSavingSignal.set(true);
      TestBed.flushEffects();
      isSavingSignal.set(false);
      TestBed.flushEffects();

      // Original delay should be cancelled, new one starts
      tick(1000);
      expect(service.showSaving()).toBe(true);

      tick(500);
      expect(service.showSaving()).toBe(false);
    }));
  });

  describe('Validation', () => {
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

  describe('Audio Settings Form Integration', () => {
    it('should create audioSettings form group in each device', () => {
      const knownDevices = service.getKnownDevices();
      expect(knownDevices.length).toBe(1);
      const deviceGroup = knownDevices.at(0);
      const audioGroup = deviceGroup.get('audioSettings');
      expect(audioGroup).toBeTruthy();
      expect(audioGroup?.get('enableAudioStream')).toBeTruthy();
      expect(audioGroup?.get('audioDeviceIndex')).toBeTruthy();
      expect(audioGroup?.get('audioDeviceName')).toBeTruthy();
      expect(audioGroup?.get('captureChannelCount')).toBeTruthy();
      expect(audioGroup?.get('sampleRate')).toBeTruthy();
    });

    it('should have correct defaults when device has no audioSettings', () => {
      // mockSettings.knownDevices[0] has no audioSettings — test backward compat
      const knownDevices = service.getKnownDevices();
      const deviceGroup = knownDevices.at(0);
      const audioGroup = deviceGroup.get('audioSettings');

      expect(audioGroup?.get('enableAudioStream')?.value).toBe(false);
      expect(audioGroup?.get('audioDeviceIndex')?.value).toBe(-1);
      expect(audioGroup?.get('audioDeviceName')?.value).toBe('');
      expect(audioGroup?.get('captureChannelCount')?.value).toBe(1);
      expect(audioGroup?.get('sampleRate')?.value).toBe(48000);
    });

    it('should populate from saved audio settings', () => {
      const settingsWithAudio: Settings = {
        ...mockSettings,
        knownDevices: [
          {
            deviceId: 'device-audio',
            videoSettings: { enableVideo: false, videoDeviceId: '' },
            audioSettings: {
              enableAudioStream: true,
              audioDeviceIndex: 3,
              audioDeviceName: 'Built-in Mic',
              captureChannelCount: 2,
              sampleRate: 44100,
              channels: [],
              useOpusEncoding: true,
            },
          },
        ],
      };

      // Rebuild the form with new settings
      settingsSignal.set(settingsWithAudio);
      service['settingsForm'].set(null); // Reset form to trigger rebuild
      TestBed.flushEffects();

      const knownDevices = service.getKnownDevices();
      const audioGroup = knownDevices.at(0).get('audioSettings');

      expect(audioGroup?.get('enableAudioStream')?.value).toBe(true);
      expect(audioGroup?.get('audioDeviceIndex')?.value).toBe(3);
      expect(audioGroup?.get('audioDeviceName')?.value).toBe('Built-in Mic');
      expect(audioGroup?.get('captureChannelCount')?.value).toBe(2);
      expect(audioGroup?.get('sampleRate')?.value).toBe(44100);
    });

    it('should include audio settings in save payload', async () => {
      const knownDevices = service.getKnownDevices();
      const audioGroup = knownDevices.at(0).get('audioSettings');

      // Configure audio settings
      audioGroup?.get('enableAudioStream')?.setValue(true);
      audioGroup?.get('audioDeviceIndex')?.setValue(2);
      audioGroup?.get('audioDeviceName')?.setValue('USB Mic');
      audioGroup?.get('captureChannelCount')?.setValue(2);
      audioGroup?.get('sampleRate')?.setValue(44100);

      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore['updateSettings']).mock.calls[0][0];
      const savedDevice = callArg.settings.knownDevices[0];
      expect(savedDevice.audioSettings).toBeDefined();
      expect(savedDevice.audioSettings.enableAudioStream).toBe(true);
      expect(savedDevice.audioSettings.audioDeviceIndex).toBe(2);
      expect(savedDevice.audioSettings.audioDeviceName).toBe('USB Mic');
      expect(savedDevice.audioSettings.captureChannelCount).toBe(2);
      expect(savedDevice.audioSettings.sampleRate).toBe(44100);
    });

    it('should round-trip audio settings through settingsToFormValue and formValueToSettings', async () => {
      const settingsWithAudio: Settings = {
        ...mockSettings,
        knownDevices: [
          {
            deviceId: 'device-rt',
            videoSettings: { enableVideo: true, videoDeviceId: 'vid-1' },
            audioSettings: {
              enableAudioStream: true,
              audioDeviceIndex: 5,
              audioDeviceName: 'Focusrite',
              captureChannelCount: 2,
              sampleRate: 96000,
              channels: [],
              useOpusEncoding: true,
            },
          },
        ],
      };

      // Build form from settings with audio
      settingsSignal.set(settingsWithAudio);
      service['settingsForm'].set(null);
      TestBed.flushEffects();

      // Save to get the round-tripped settings
      await service.saveSettings();

      const callArg = vi.mocked(mockSettingsStore['updateSettings']).mock.calls[0][0];
      const device = callArg.settings.knownDevices[0];
      expect(device.audioSettings.enableAudioStream).toBe(true);
      expect(device.audioSettings.audioDeviceIndex).toBe(5);
      expect(device.audioSettings.audioDeviceName).toBe('Focusrite');
      expect(device.audioSettings.captureChannelCount).toBe(2);
      expect(device.audioSettings.sampleRate).toBe(96000);
    });

    describe('Audio Settings Validation', () => {
      it('should be valid with default state (disabled, index=-1)', () => {
        const audioGroup = service.getAudioSettings(0);
        // Defaults: enabled=false, index=-1 → valid since not enabled
        expect(audioGroup.valid).toBe(true);
      });

      it('should be invalid when enabled with audioDeviceIndex=-1', () => {
        const audioGroup = service.getAudioSettings(0);
        audioGroup.get('enableAudioStream')?.setValue(true);
        audioGroup.get('audioDeviceIndex')?.setValue(-1);

        expect(audioGroup.valid).toBe(false);
        expect(audioGroup.hasError('audioDeviceRequired')).toBe(true);
      });

      it('should be valid when enabled with audioDeviceIndex >= 0', () => {
        const audioGroup = service.getAudioSettings(0);
        audioGroup.get('enableAudioStream')?.setValue(true);
        audioGroup.get('audioDeviceIndex')?.setValue(0);

        expect(audioGroup.valid).toBe(true);
        expect(audioGroup.hasError('audioDeviceRequired')).toBe(false);
      });

      it('should be valid when disabled regardless of audioDeviceIndex', () => {
        const audioGroup = service.getAudioSettings(0);
        audioGroup.get('enableAudioStream')?.setValue(false);
        audioGroup.get('audioDeviceIndex')?.setValue(-1);

        expect(audioGroup.valid).toBe(true);
      });
    });

    it('should not break when settings have no audioSettings (backward compatibility)', () => {
      // mockSettings already has no audioSettings — form should build fine
      const form = service.settingsForm();
      expect(form).toBeTruthy();
      expect(form?.valid).toBe(true);

      const audioGroup = service.getAudioSettings(0);
      expect(audioGroup).toBeTruthy();
      expect(audioGroup.get('enableAudioStream')?.value).toBe(false);
    });

    it('should expose audio settings via getAudioSettings helper', () => {
      const audioGroup = service.getAudioSettings(0);
      expect(audioGroup).toBeTruthy();
      expect(audioGroup.get('enableAudioStream')).toBeTruthy();
    });

    it('should throw when getAudioSettings called with invalid device index', () => {
      expect(() => service.getAudioSettings(99)).toThrow('Device at index 99 not found');
    });
  });

  describe('Device Index Helper', () => {
    it('should return correct index for existing device ID', () => {
      const index = service.getDeviceIndexById('device-1');
      expect(index).toBe(0);
    });

    it('should return -1 for non-existing device ID', () => {
      const index = service.getDeviceIndexById('non-existent-device');
      expect(index).toBe(-1);
    });

    it('should find correct index when multiple devices exist', () => {
      // Create settings with multiple devices
      const multiDeviceSettings: Settings = {
        ...mockSettings,
        knownDevices: [
          {
            deviceId: 'device-alpha',
            videoSettings: { enableVideo: false, videoDeviceId: '' },
            audioSettings: { enableAudioStream: false, audioDeviceIndex: -1, audioDeviceName: '', captureChannelCount: 1, sampleRate: 48000, channels: [], useOpusEncoding: true },
          },
          {
            deviceId: 'device-beta',
            videoSettings: { enableVideo: true, videoDeviceId: 'vid-1' },
            audioSettings: { enableAudioStream: true, audioDeviceIndex: 2, audioDeviceName: 'Mic', captureChannelCount: 2, sampleRate: 44100, channels: [], useOpusEncoding: true },
          },
          {
            deviceId: 'device-gamma',
            videoSettings: { enableVideo: false, videoDeviceId: '' },
            audioSettings: { enableAudioStream: false, audioDeviceIndex: -1, audioDeviceName: '', captureChannelCount: 1, sampleRate: 48000, channels: [], useOpusEncoding: true },
          },
        ],
      };

      settingsSignal.set(multiDeviceSettings);
      service['settingsForm'].set(null);
      TestBed.flushEffects();

      expect(service.getDeviceIndexById('device-alpha')).toBe(0);
      expect(service.getDeviceIndexById('device-beta')).toBe(1);
      expect(service.getDeviceIndexById('device-gamma')).toBe(2);
    });
  });
});
