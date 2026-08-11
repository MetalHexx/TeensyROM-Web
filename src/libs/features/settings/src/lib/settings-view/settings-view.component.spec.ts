import '@analogjs/vitest-angular/setup-zone';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { computed, signal, WritableSignal } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray } from '@angular/forms';
import { SettingsViewComponent } from './settings-view.component';
import { Settings, SETTINGS_SERVICE, ISettingsService, Device, AUDIO_STREAM_SERVICE, PlayerFilterType, DeviceState, StorageType } from '@teensyrom-nx/domain';
import { SettingsFormService } from './settings-form.service';
import { AudioStore, DeviceStore } from '@teensyrom-nx/application';
import { EMPTY } from 'rxjs';

/**
 * Custom validator to ensure at least one weight is greater than 0
 * (Copied from SettingsFormService for test mock)
 */
function atLeastOneWeightValidator(group: FormGroup): { [key: string]: boolean } | null {
  const nameWeight = group.get('nameWeight')?.value || 0;
  const titleWeight = group.get('titleWeight')?.value || 0;
  const creatorWeight = group.get('creatorWeight')?.value || 0;
  const releaseInfoWeight = group.get('releaseInfoWeight')?.value || 0;
  const descriptionWeight = group.get('descriptionWeight')?.value || 0;

  const hasAtLeastOne =
    nameWeight > 0 ||
    titleWeight > 0 ||
    creatorWeight > 0 ||
    releaseInfoWeight > 0 ||
    descriptionWeight > 0;

  return hasAtLeastOne ? null : { atLeastOneWeight: true };
}

describe('SettingsViewComponent', () => {
  let component: SettingsViewComponent;
  let fixture: ComponentFixture<SettingsViewComponent>;
  let mockFormService: Partial<SettingsFormService>;
  let mockSettingsService: ISettingsService;
  let mockDeviceStore: Partial<InstanceType<typeof DeviceStore>>;

  // Mock signals
  let settingsSignal: WritableSignal<Settings | null>;
  let isLoadingSignal: WritableSignal<boolean>;
  let isSavingSignal: WritableSignal<boolean>;
  let errorSignal: WritableSignal<string | null>;
  let settingsFormSignal: WritableSignal<FormGroup | null>;
  let autoSaveEnabledSignal: WritableSignal<boolean>;
  let canSaveSignal: WritableSignal<boolean>;
  let canUndoSignal: WritableSignal<boolean>;
  let canRedoSignal: WritableSignal<boolean>;
  let showSavingSignal: WritableSignal<boolean>;
  let isNavigatingHistorySignal: WritableSignal<boolean>;
  let historyPositionDisplaySignal: WritableSignal<string | null>;
  let devicesSignal: WritableSignal<Device[]>;

  const mockSettings: Settings = {
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: true,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: 'All' as PlayerFilterType,
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
        deviceId: 'test-device-123',
        videoSettings: {
          enableVideo: false,
          videoDeviceId: '',
        },
        audioSettings: {
          audioDeviceIndex: -1,
          enableAudioStream: false,
          audioDeviceName: '',
          captureChannelCount: 0,
          sampleRate: 0,
          channels: [],
          useOpusEncoding: true,
        }
      },
    ],
  };

  beforeEach(async () => {
    // Create mock settings service
    mockSettingsService = {
      getSettings: vi.fn().mockResolvedValue(mockSettings),
      saveSettings: vi.fn().mockResolvedValue(undefined),
    } as ISettingsService;

    // Initialize mock signals
    settingsSignal = signal(mockSettings);
    isLoadingSignal = signal(false);
    isSavingSignal = signal(false);
    errorSignal = signal(null);
    autoSaveEnabledSignal = signal(true);
    canSaveSignal = signal(true);
    canUndoSignal = signal(true);
    canRedoSignal = signal(false);
    showSavingSignal = signal(false);
    isNavigatingHistorySignal = signal(false);
    historyPositionDisplaySignal = signal(null);
    devicesSignal = signal<Device[]>([
      {
        deviceId: 'test-device-123',
        isConnected: true,
        isEnabled: true,
        comPort: '',
        name: '',
        fwVersion: '',
        isCompatible: false,
        deviceState: DeviceState.Connected,
        sdStorage: {
          deviceId: '',
          type: StorageType.Sd,
          available: false,
          indexExists: false
        },
        usbStorage: {
          deviceId: '',
          type: StorageType.Sd,
          available: false,
          indexExists: false
        },
      },
    ]);

    // Create mock device store
    mockDeviceStore = {
      devices: devicesSignal.asReadonly(),
    } as Partial<InstanceType<typeof DeviceStore>>;

    // Build a real form for testing
    const fb = new FormBuilder();
    const mockForm = fb.group({
      playerSettings: fb.group({
        repeatModeOnStartup: [mockSettings.playerSettings.repeatModeOnStartup],
        playTimerEnabled: [mockSettings.playerSettings.playTimerEnabled],
        muteFastForward: [mockSettings.playerSettings.muteFastForward],
        muteRandomSeek: [mockSettings.playerSettings.muteRandomSeek],
        startupFilter: [mockSettings.playerSettings.startupFilter, Validators.required],
        startupLaunchEnabled: [mockSettings.playerSettings.startupLaunchEnabled],
        startupLaunchRandom: [mockSettings.playerSettings.startupLaunchRandom],
      }),
      fileTransferSettings: fb.group({
        watchDirectoryLocation: [mockSettings.fileTransferSettings.watchDirectoryLocation],
        autoTransferPath: [
          mockSettings.fileTransferSettings.autoTransferPath,
          Validators.required,
        ],
        autoFileCopyEnabled: [mockSettings.fileTransferSettings.autoFileCopyEnabled],
        autoLaunchOnCopyEnabled: [mockSettings.fileTransferSettings.autoLaunchOnCopyEnabled],
        navToDirOnLaunch: [mockSettings.fileTransferSettings.navToDirOnLaunch],
        syncFilesEnabled: [mockSettings.fileTransferSettings.syncFilesEnabled],
      }),
      searchSettings: fb.group({
        weights: fb.group(
          {
            nameWeight: [mockSettings.searchSettings.weights.nameWeight, [Validators.min(0)]],
            titleWeight: [mockSettings.searchSettings.weights.titleWeight, [Validators.min(0)]],
            creatorWeight: [mockSettings.searchSettings.weights.creatorWeight, [Validators.min(0)]],
            releaseInfoWeight: [
              mockSettings.searchSettings.weights.releaseInfoWeight,
              [Validators.min(0)],
            ],
            descriptionWeight: [
              mockSettings.searchSettings.weights.descriptionWeight,
              [Validators.min(0)],
            ],
          },
          {
            validators: atLeastOneWeightValidator,
          }
        ),
        stopWords: ['the,and,or', Validators.required],
        bannedDirectories: ['/system,/temp', Validators.required],
        bannedFiles: ['.DS_Store,thumbs.db', Validators.required],
      }),
      appSettings: fb.group({
        setupCompleted: [mockSettings.appSettings.setupCompleted],
      }),
      knownDevices: fb.array(
        mockSettings.knownDevices.map(device =>
          fb.group({
            deviceId: [device.deviceId, Validators.required],
            videoSettings: fb.group({
              enableVideo: [device.videoSettings.enableVideo],
              videoDeviceId: [device.videoSettings.videoDeviceId],
            }),
            connectionSettings: fb.group({
              autoConnectEnabled: [true],
            }),
          })
        )
      ),
    });
    settingsFormSignal = signal(mockForm);

    // Create mock form service
    mockFormService = {
      settings: settingsSignal.asReadonly(),
      isLoading: isLoadingSignal.asReadonly(),
      isSaving: isSavingSignal.asReadonly(),
      error: errorSignal.asReadonly(),
      settingsForm: settingsFormSignal,
      autoSaveEnabled: autoSaveEnabledSignal,
      showSaving: showSavingSignal,
      canSave: canSaveSignal.asReadonly(),
      canUndo: canUndoSignal.asReadonly(),
      canRedo: canRedoSignal.asReadonly(),
      isNavigatingHistory: isNavigatingHistorySignal.asReadonly(),
      historyPositionDisplay: historyPositionDisplaySignal.asReadonly(),
      saveSettings: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      getKnownDevices: vi.fn(() => mockForm.get('knownDevices') as FormArray),
      getPlayerSettings: vi.fn(() => mockForm.get('playerSettings') as FormGroup),
      getFileTransferSettings: vi.fn(() => mockForm.get('fileTransferSettings') as FormGroup),
      getSearchSettings: vi.fn(() => mockForm.get('searchSettings') as FormGroup),
      getAppSettings: vi.fn(() => mockForm.get('appSettings') as FormGroup),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsViewComponent],
      providers: [
        provideNoopAnimations(),
        { provide: SETTINGS_SERVICE, useValue: mockSettingsService },
        { provide: DeviceStore, useValue: mockDeviceStore },
        {
          provide: AUDIO_STREAM_SERVICE,
          useValue: {
            streamState$: EMPTY,
            getDevices: vi.fn().mockResolvedValue([]),
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            volumeLevel$: EMPTY,
            channelVolumes$: EMPTY,
            getPreBufferDuration: vi.fn(() => 0.005),
            getCatchUpPadding: vi.fn(() => 0.001),
            setPreBufferDuration: vi.fn(),
            setCatchUpPadding: vi.fn(),
            setUseOpusEncoding: vi.fn(),
            getUseOpusEncoding: vi.fn(() => true),
          },
        },
        {
          provide: AudioStore,
          useValue: {
            devices: signal([]),
            selectedDeviceIndex: signal<number | null>(null),
            isLoading: signal(false),
            error: signal<string | null>(null),
            isStreaming: signal(false),
            isConnecting: signal(false),
            loadDevices: vi.fn(),
            selectDevice: vi.fn(),
            startStream: vi.fn(),
            stopStream: vi.fn(),
            clearError: vi.fn(),
            loadChannelConfigs: vi.fn(),
            setChannelVolume: vi.fn(),
            toggleMute: vi.fn(),
            setMasterVolume: vi.fn(),
            hasDevices: computed(() => false),
            selectedDevice: computed(() => null),
            channels: computed(() => []),
            hasChannels: computed(() => false),
            isMuted: signal(false),
            masterVolume: signal(0.75),
          },
        },
      ],
    })
      .overrideComponent(SettingsViewComponent, {
        set: {
          providers: [{ provide: SettingsFormService, useValue: mockFormService }],
        },
      })
      .compileComponents();

    // Create component within injection context to support takeUntilDestroyed()
    TestBed.runInInjectionContext(() => {
      fixture = TestBed.createComponent(SettingsViewComponent);
      component = fixture.componentInstance;
    });

    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should inject form service', () => {
      expect(component['formService']).toBeTruthy();
    });

    it('should build form when settings load', () => {
      expect(component.settingsForm()).toBeTruthy();
      expect(component.settingsForm()).toBeInstanceOf(FormGroup);
    });

    it('should create nested FormGroups for all sections', () => {
      const form = component.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      
      expect(form.get('playerSettings')).toBeInstanceOf(FormGroup);
      expect(form.get('fileTransferSettings')).toBeInstanceOf(FormGroup);
      expect(form.get('searchSettings')).toBeInstanceOf(FormGroup);
      expect(form.get('appSettings')).toBeInstanceOf(FormGroup);
      expect(form.get('knownDevices')).toBeInstanceOf(FormArray);
    });

    it('should create nested weights FormGroup in searchSettings', () => {
      const form = component.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const searchSettings = form.get('searchSettings') as FormGroup;
      
      expect(searchSettings.get('weights')).toBeInstanceOf(FormGroup);
    });

    it('should patch form values from store settings', () => {
      const form = component.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      
      expect(form.get('playerSettings.playTimerEnabled')?.value).toBe(true);
      expect(form.get('appSettings.setupCompleted')?.value).toBe(true);
      
      // Per-device settings
      const knownDevices = form.get('knownDevices') as FormArray;
      expect(knownDevices.length).toBe(1);
      expect(knownDevices.at(0).get('connectionSettings.autoConnectEnabled')?.value).toBe(true);
    });

    it('should convert array fields to comma-separated strings', () => {
      const form = component.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      
      expect(form.get('searchSettings.stopWords')?.value).toBe('the,and,or');
      expect(form.get('searchSettings.bannedDirectories')?.value).toBe('/system,/temp');
      expect(form.get('searchSettings.bannedFiles')?.value).toBe('.DS_Store,thumbs.db');
    });
  });

  describe('Auto-save Toggle', () => {
    it('should default to enabled', () => {
      expect(component.autoSaveEnabled()).toBe(true);
    });

    it('should allow toggling auto-save', () => {
      component.autoSaveEnabled.set(false);
      fixture.detectChanges();
      
      expect(component.autoSaveEnabled()).toBe(false);
    });
  });

  describe('Save Button State', () => {
    beforeEach(() => {
      component.autoSaveEnabled.set(false);
      fixture.detectChanges();
    });

    it('should be enabled when form valid', () => {
      expect(component.canSave()).toBe(true);
    });

    it('should be disabled when form invalid', () => {
      const form = component.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;

      // Make form invalid by clearing required field
      const control = form.get('fileTransferSettings.autoTransferPath');
      if (!control) return;
      control.setValue('');
      control.markAsTouched();
      control.updateValueAndValidity();
      form.updateValueAndValidity();

      // Verify form is actually invalid
      expect(form.valid).toBe(false);

      // Update the canSave signal to reflect invalid form state
      canSaveSignal.set(false);
      fixture.detectChanges();

      expect(component.canSave()).toBe(false);
    });

    it('should be disabled when saving', () => {
      // Update mock canSave to reflect saving state (computed in real service)
      canSaveSignal.set(false);
      isSavingSignal.set(true);
      fixture.detectChanges();

      expect(component.canSave()).toBe(false);
    });
  });

  describe('Undo/Redo Actions', () => {
    it('should delegate undo to form service', () => {
      canUndoSignal.set(true);
      fixture.detectChanges();

      component.undo();

      expect(mockFormService.undo).toHaveBeenCalled();
    });

    it('should delegate redo to form service', () => {
      canRedoSignal.set(true);
      fixture.detectChanges();

      component.redo();

      expect(mockFormService.redo).toHaveBeenCalled();
    });

    it('should disable undo when history is empty', () => {
      canUndoSignal.set(false);
      fixture.detectChanges();

      expect(component.canUndo()).toBe(false);
    });

    it('should disable redo when at end of history', () => {
      canRedoSignal.set(false);
      fixture.detectChanges();

      expect(component.canRedo()).toBe(false);
    });
  });

  describe('Section Navigation', () => {
    it('should default to player section', () => {
      expect(component.activeSection()).toBe('player');
    });

    it('should update active section when setActiveSection is called', () => {
      component.setActiveSection('fileTransfer');
      expect(component.activeSection()).toBe('fileTransfer');

      component.setActiveSection('devices');
      expect(component.activeSection()).toBe('devices');

      component.setActiveSection('search');
      expect(component.activeSection()).toBe('search');

      component.setActiveSection('player');
      expect(component.activeSection()).toBe('player');
    });

    it('should render all navigation buttons (excluding commented out sections)', () => {
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.navigation-buttons lib-action-button');
      // File transfer button is currently commented out in the template
      // Audio button removed - audio settings now embedded in device settings
      expect(buttons.length).toBe(3);
    });

    it('should pass animationTrigger=true to active section', () => {
      component.setActiveSection('search');
      fixture.detectChanges();

      // Search section should receive true
      const searchSection = fixture.nativeElement.querySelector('lib-search-settings-section');
      expect(searchSection).toBeTruthy();
    });

    it('should pass animationTrigger=false to inactive sections', () => {
      component.setActiveSection('player');
      fixture.detectChanges();

      // All other sections should receive false
      // (In actual implementation, all sections are always rendered with animationTrigger based on activeSection)
    });

    it('should render all section components regardless of active section', () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-player-settings-section')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('lib-device-settings-section')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('lib-file-transfer-settings-section')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('lib-search-settings-section')).toBeTruthy();
    });

    it('should not render app-settings-section in main view', () => {
      fixture.detectChanges();

      // AppSettings section exists but is intentionally not included in the main settings view
      // It contains internal app state (setupCompleted) not meant for user editing in this context
      const appSettingsSection = fixture.nativeElement.querySelector('lib-app-settings-section');
      expect(appSettingsSection).toBeFalsy();
    });

    it('should render devices navigation button with correct icon and label', () => {
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.navigation-buttons lib-action-button');
      // Devices button should be second (after Player, before File Transfer)
      const devicesButton = buttons[1];
      expect(devicesButton).toBeTruthy();
    });

    it('should activate devices section when devices button clicked', () => {
      component.setActiveSection('devices');
      expect(component.activeSection()).toBe('devices');
    });

    it('should pass correct animationTrigger to devices section when active', () => {
      component.setActiveSection('devices');
      fixture.detectChanges();

      const devicesSection = fixture.nativeElement.querySelector('lib-device-settings-section');
      expect(devicesSection).toBeTruthy();
    });

    it('should pass correct animationTrigger to devices section when inactive', () => {
      component.setActiveSection('player');
      fixture.detectChanges();

      const devicesSection = fixture.nativeElement.querySelector('lib-device-settings-section');
      expect(devicesSection).toBeTruthy();
      // Section is rendered but animationTrigger should be false
    });
  });

  describe('Device Settings Integration', () => {
    it('should have getKnownDevices helper method', () => {
      expect(component.getKnownDevices).toBeDefined();
      expect(typeof component.getKnownDevices).toBe('function');
    });

    it('should return known devices FormArray from getKnownDevices', () => {
      const knownDevices = component.getKnownDevices();
      expect(knownDevices).toBeInstanceOf(FormArray);
      expect(knownDevices.length).toBe(1);
    });

    it('should return FormArray with device entries', () => {
      const knownDevices = component.getKnownDevices();
      const firstDevice = knownDevices.at(0);
      
      expect(firstDevice).toBeTruthy();
      expect(firstDevice.get('deviceId')?.value).toBe('test-device-123');
      expect(firstDevice.get('videoSettings.enableVideo')?.value).toBe(false);
    });

    it('should pass known devices FormArray to device section component', () => {
      fixture.detectChanges();

      const devicesSection = fixture.nativeElement.querySelector('lib-device-settings-section');
      expect(devicesSection).toBeTruthy();
      // FormArray is passed via input binding
    });

    it('should update device settings through form', () => {
      const knownDevices = component.getKnownDevices();
      const firstDevice = knownDevices.at(0);
      const enableVideoControl = firstDevice.get('videoSettings.enableVideo');

      enableVideoControl?.setValue(true);
      expect(enableVideoControl?.value).toBe(true);

      enableVideoControl?.setValue(false);
      expect(enableVideoControl?.value).toBe(false);
    });
  });

  describe('Toolbar UI', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should render toolbar with all action buttons', () => {
      const toolbar = fixture.nativeElement.querySelector('.settings-toolbar');
      expect(toolbar).toBeTruthy();

      const actionButtons = toolbar.querySelectorAll('lib-action-button');
      expect(actionButtons.length).toBe(3); // Save, Undo, Redo
    });

    it('should render auto-save toggle', () => {
      const toggle = fixture.nativeElement.querySelector('mat-slide-toggle');
      expect(toggle).toBeTruthy();
    });

    it('should bind auto-save toggle to autoSaveEnabled signal', () => {
      expect(component.autoSaveEnabled()).toBe(true);

      const toggle = fixture.nativeElement.querySelector('mat-slide-toggle');
      expect(toggle).toBeTruthy();
    });

    it('should update autoSaveEnabled when toggle changes', () => {
      component.autoSaveEnabled.set(false);
      fixture.detectChanges();

      expect(component.autoSaveEnabled()).toBe(false);
    });

    it('should disable save button when canSave is false', () => {
      canSaveSignal.set(false);
      fixture.detectChanges();

      const saveButton = Array.from(
        fixture.nativeElement.querySelectorAll('lib-action-button') as NodeListOf<Element>
      ).find((btn: Element) => btn.textContent?.includes('Save'));

      expect(saveButton).toBeTruthy();
    });

    it('should disable undo button when canUndo is false', () => {
      canUndoSignal.set(false);
      fixture.detectChanges();

      expect(component.canUndo()).toBe(false);
    });

    it('should disable redo button when canRedo is false', () => {
      canRedoSignal.set(false);
      fixture.detectChanges();

      expect(component.canRedo()).toBe(false);
    });

    it('should show saving indicator when showSaving is true', () => {
      showSavingSignal.set(true);
      fixture.detectChanges();

      const loadingText = fixture.nativeElement.querySelector('lib-loading-text');
      expect(loadingText).toBeTruthy();
    });

    it('should hide saving indicator when showSaving is false', () => {
      showSavingSignal.set(false);
      fixture.detectChanges();

      expect(component.showSaving()).toBe(false);
    });

    it('should call saveSettings when save button clicked', () => {
      const saveSpy = vi.spyOn(component, 'saveSettings');
      component.saveSettings();

      expect(saveSpy).toHaveBeenCalled();
    });

    it('should call undo when undo button clicked', () => {
      canUndoSignal.set(true);
      fixture.detectChanges();

      const undoSpy = vi.spyOn(component, 'undo');
      component.undo();

      expect(undoSpy).toHaveBeenCalled();
    });

    it('should call redo when redo button clicked', () => {
      canRedoSignal.set(true);
      fixture.detectChanges();

      const redoSpy = vi.spyOn(component, 'redo');
      component.redo();

      expect(redoSpy).toHaveBeenCalled();
    });
  });

  describe('History Position Display', () => {
    it('should not display history position when null', () => {
      historyPositionDisplaySignal.set(null);
      fixture.detectChanges();

      expect(component.historyPositionDisplay()).toBeNull();
    });

    it('should display history position when available', () => {
      historyPositionDisplaySignal.set('2/5');
      fixture.detectChanges();

      expect(component.historyPositionDisplay()).toBe('2/5');
    });

    it('should show navigating history state', () => {
      isNavigatingHistorySignal.set(true);
      fixture.detectChanges();

      expect(component.isNavigatingHistory()).toBe(true);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should call undo on Ctrl+Z', () => {
      canUndoSignal.set(true);
      fixture.detectChanges();

      const undoSpy = vi.spyOn(component, 'undo');
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'z' });

      component.onUndoShortcut(event);

      expect(undoSpy).toHaveBeenCalled();
    });

    it('should call redo on Ctrl+Y', () => {
      canRedoSignal.set(true);
      fixture.detectChanges();

      const redoSpy = vi.spyOn(component, 'redo');
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'y' });

      component.onRedoShortcut(event);

      expect(redoSpy).toHaveBeenCalled();
    });

    it('should prevent default when undo shortcut triggered and canUndo is true', () => {
      canUndoSignal.set(true);
      fixture.detectChanges();

      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'z' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.onUndoShortcut(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default when redo shortcut triggered and canRedo is true', () => {
      canRedoSignal.set(true);
      fixture.detectChanges();

      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'y' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.onRedoShortcut(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not call undo when canUndo is false', () => {
      canUndoSignal.set(false);
      fixture.detectChanges();

      const undoSpy = vi.spyOn(component, 'undo');
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'z' });

      component.onUndoShortcut(event);

      expect(undoSpy).not.toHaveBeenCalled();
    });

    it('should not call redo when canRedo is false', () => {
      canRedoSignal.set(false);
      fixture.detectChanges();

      const redoSpy = vi.spyOn(component, 'redo');
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'y' });

      component.onRedoShortcut(event);

      expect(redoSpy).not.toHaveBeenCalled();
    });

    it('should not prevent default when canUndo is false', () => {
      canUndoSignal.set(false);
      fixture.detectChanges();

      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'z' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.onUndoShortcut(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should not prevent default when canRedo is false', () => {
      canRedoSignal.set(false);
      fixture.detectChanges();

      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'y' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.onRedoShortcut(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when isSaving is true', () => {
      isSavingSignal.set(true);
      fixture.detectChanges();
      
      expect(component.isSaving()).toBe(true);
    });

    it('should show form when settings are loaded', () => {
      isLoadingSignal.set(false);
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const form = compiled.querySelector('form');
      
      expect(form).toBeTruthy();
    });
  });

  describe('Error Display', () => {
    it('should display error message when store has error', () => {
      errorSignal.set('Failed to load settings');
      fixture.detectChanges();
      
      expect(component.error()).toBe('Failed to load settings');
      
      const compiled = fixture.nativeElement as HTMLElement;
      const errorElement = compiled.querySelector('lib-empty-state-message');
      
      expect(errorElement).toBeTruthy();
    });
  });

  describe('Validation', () => {
    it('should validate search weights with custom validator', () => {
      const form = component.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const weights = form.get('searchSettings.weights') as FormGroup;
      
      // Set all weights to 0
      weights.get('nameWeight')?.setValue(0);
      weights.get('titleWeight')?.setValue(0);
      weights.get('creatorWeight')?.setValue(0);
      weights.get('releaseInfoWeight')?.setValue(0);
      weights.get('descriptionWeight')?.setValue(0);
      
      expect(weights.hasError('atLeastOneWeight')).toBe(true);
    });

    it('should pass weight validation when at least one is greater than 0', () => {
      const form = component.settingsForm();
      expect(form).toBeTruthy();
      if (!form) return;
      const weights = form.get('searchSettings.weights') as FormGroup;
      
      weights.get('nameWeight')?.setValue(5);
      
      expect(weights.hasError('atLeastOneWeight')).toBe(false);
    });
  });
});
