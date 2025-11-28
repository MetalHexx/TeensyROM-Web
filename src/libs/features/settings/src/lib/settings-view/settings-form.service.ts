import { Injectable, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs/operators';
import { SettingsStore } from '@teensyrom-nx/application';
import { Settings, DeviceSettings } from '@teensyrom-nx/domain';
import { arrayToString, stringToArray } from '@teensyrom-nx/utils';

/**
 * Facade service that coordinates settings form management and store interactions.
 * 
 * Responsibilities:
 * - Form building and validation
 * - Form ↔ Settings model transformations
 * - Auto-save coordination
 * - Undo/redo management
 * - Store state synchronization
 * 
 * This service acts as a facade between the settings view component and the application layer,
 * encapsulating all business logic and keeping the component purely presentational.
 */
@Injectable()
export class SettingsFormService {
  private readonly settingsStore = inject(SettingsStore);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Main settings form signal
   */
  readonly settingsForm = signal<FormGroup | null>(null);

  /**
   * Auto-save toggle state (enabled by default)
   */
  readonly autoSaveEnabled = signal<boolean>(true);

  /**
   * Flag to prevent auto-save when syncing form from store (undo/redo)
   */
  private readonly isSyncingFromStore = signal<boolean>(false);

  /**
   * Timer for delayed saving indicator
   */
  private savingTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Store state signals (pass-through for component consumption)
   */
  readonly settings = this.settingsStore.getSettings();
  readonly isLoading = this.settingsStore.isLoading;
  readonly error = this.settingsStore.error;
  readonly isSaving = computed(() => this.settingsStore.isSaving());

  /**
   * Delayed saving indicator - stays visible for minimum 1.5s even if save completes faster
   * Provides better UX feedback for quick auto-saves
   */
  readonly showSaving = signal<boolean>(false);

  /**
   * Computed: whether manual save is allowed
   */
  readonly canSave = computed(() => {
    const form = this.settingsForm();
    return form !== null && form.valid && !this.isSaving();
  });

  /**
   * Computed: whether undo is available (from store computed signal)
   */
  readonly canUndo = computed(() => this.settingsStore.canUndo()());

  /**
   * Computed: whether redo is available (from store computed signal)
   */
  readonly canRedo = computed(() => this.settingsStore.canRedo()());

  /**
   * Computed: whether user is navigating history (from store computed signal)
   */
  readonly isNavigatingHistory = computed(() => this.settingsStore.isNavigatingHistory()());

  /**
   * Computed: formatted history position display (from store computed signal)
   */
  readonly historyPositionDisplay = computed(() => this.settingsStore.historyPositionDisplay()());

  constructor() {
    this.initializeForm();
    this.setupAutoSave();
    this.setupStoreSync();
    this.setupSavingIndicator();
  }

  /**
   * Initialize form when settings load
   */
  private initializeForm(): void {
    effect(() => {
      const settings = this.settings();
      if (settings && !this.settingsForm()) {
        const form = this.buildForm(settings);
        this.settingsForm.set(form);
      }
    });
  }

  /**
   * Setup auto-save on form value changes
   */
  private setupAutoSave(): void {
    effect(() => {
      const form = this.settingsForm();
      if (form) {
        form.valueChanges
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            debounceTime(1000),
            filter(() => form.valid),
            filter(() => this.autoSaveEnabled()),
            filter(() => !this.isSyncingFromStore())
          )
          .subscribe(async () => {
            await this.saveSettings();
          });
      }
    });
  }

  /**
   * Setup form sync from store (for undo/redo)
   */
  private setupStoreSync(): void {
    effect(() => {
      const settings = this.settings();
      const form = this.settingsForm();
      const position = this.settingsStore.historyPosition();

      // Only sync if form exists and we're navigating history
      if (settings && form && position !== -1) {
        this.isSyncingFromStore.set(true);
        form.patchValue(this.settingsToFormValue(settings), { emitEvent: false });
        this.isSyncingFromStore.set(false);
      }
    });
  }

  /**
   * Setup saving indicator with minimum display duration
   * Shows indicator for at least 1.5s even if save completes faster
   */
  private setupSavingIndicator(): void {
    effect(() => {
      const saving = this.isSaving();

      if (saving) {
        // Show immediately when saving starts
        this.showSaving.set(true);
        
        // Clear any existing timer
        if (this.savingTimer) {
          clearTimeout(this.savingTimer);
          this.savingTimer = null;
        }
      } else if (this.showSaving()) {
        // When saving completes, keep showing for minimum duration
        this.savingTimer = setTimeout(() => {
          this.showSaving.set(false);
          this.savingTimer = null;
        }, 1500);
      }
    });
  }

  /**
   * Builds the complete reactive form structure matching the Settings domain model
   */
  private buildForm(settings: Settings): FormGroup {
    return this.fb.group({
      playerSettings: this.fb.group({
        repeatModeOnStartup: [settings.playerSettings.repeatModeOnStartup],
        playTimerEnabled: [settings.playerSettings.playTimerEnabled],
        muteFastForward: [settings.playerSettings.muteFastForward],
        muteRandomSeek: [settings.playerSettings.muteRandomSeek],
        startupFilter: [settings.playerSettings.startupFilter, Validators.required],
        startupLaunchEnabled: [settings.playerSettings.startupLaunchEnabled],
        startupLaunchRandom: [settings.playerSettings.startupLaunchRandom],
      }),
      fileTransferSettings: this.fb.group({
        watchDirectoryLocation: [settings.fileTransferSettings.watchDirectoryLocation],
        autoTransferPath: [settings.fileTransferSettings.autoTransferPath, Validators.required],
        autoFileCopyEnabled: [settings.fileTransferSettings.autoFileCopyEnabled],
        autoLaunchOnCopyEnabled: [settings.fileTransferSettings.autoLaunchOnCopyEnabled],
        navToDirOnLaunch: [settings.fileTransferSettings.navToDirOnLaunch],
        syncFilesEnabled: [settings.fileTransferSettings.syncFilesEnabled],
      }),
      searchSettings: this.fb.group({
        weights: this.fb.group(
          {
            nameWeight: [settings.searchSettings.weights.nameWeight, [Validators.min(0)]],
            titleWeight: [settings.searchSettings.weights.titleWeight, [Validators.min(0)]],
            creatorWeight: [settings.searchSettings.weights.creatorWeight, [Validators.min(0)]],
            releaseInfoWeight: [
              settings.searchSettings.weights.releaseInfoWeight,
              [Validators.min(0)],
            ],
            descriptionWeight: [
              settings.searchSettings.weights.descriptionWeight,
              [Validators.min(0)],
            ],
          },
          { validators: this.atLeastOneWeightValidator }
        ),
        stopWords: [arrayToString(settings.searchSettings.stopWords), Validators.required],
        bannedDirectories: [
          arrayToString(settings.searchSettings.bannedDirectories),
          Validators.required,
        ],
        bannedFiles: [
          arrayToString(settings.searchSettings.bannedFiles),
          Validators.required,
        ],
      }),
      appSettings: this.fb.group({
        setupCompleted: [settings.appSettings.setupCompleted],
      }),
      knownDevices: this.fb.array(
        settings.knownDevices.map(device => this.createDeviceFormGroup(device))
      ),
    });
  }

  /**
   * Creates a FormGroup for a single device's settings
   */
  private createDeviceFormGroup(device: DeviceSettings): FormGroup {
    return this.fb.group({
      deviceId: [device.deviceId, Validators.required],
      videoSettings: this.fb.group({
        enableVideo: [device.videoSettings.enableVideo],
        videoDeviceId: [device.videoSettings.videoDeviceId],
      }),
      connectionSettings: this.fb.group({
        connectionType: [device.connectionSettings.connectionType, Validators.required],
        autoConnectEnabled: [device.connectionSettings.autoConnectEnabled],
      }),
    });
  }

  /**
   * Custom validator: At least one weight must be greater than 0
   */
  private atLeastOneWeightValidator(group: FormGroup): { [key: string]: boolean } | null {
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

  /**
   * Converts Settings domain model to form value structure
   */
  private settingsToFormValue(settings: Settings): ReturnType<FormGroup['getRawValue']> {
    return {
      playerSettings: {
        repeatModeOnStartup: settings.playerSettings.repeatModeOnStartup,
        playTimerEnabled: settings.playerSettings.playTimerEnabled,
        muteFastForward: settings.playerSettings.muteFastForward,
        muteRandomSeek: settings.playerSettings.muteRandomSeek,
        startupFilter: settings.playerSettings.startupFilter,
        startupLaunchEnabled: settings.playerSettings.startupLaunchEnabled,
        startupLaunchRandom: settings.playerSettings.startupLaunchRandom,
      },
      fileTransferSettings: {
        watchDirectoryLocation: settings.fileTransferSettings.watchDirectoryLocation,
        autoTransferPath: settings.fileTransferSettings.autoTransferPath,
        autoFileCopyEnabled: settings.fileTransferSettings.autoFileCopyEnabled,
        autoLaunchOnCopyEnabled: settings.fileTransferSettings.autoLaunchOnCopyEnabled,
        navToDirOnLaunch: settings.fileTransferSettings.navToDirOnLaunch,
        syncFilesEnabled: settings.fileTransferSettings.syncFilesEnabled,
      },
      searchSettings: {
        weights: {
          nameWeight: settings.searchSettings.weights.nameWeight,
          titleWeight: settings.searchSettings.weights.titleWeight,
          creatorWeight: settings.searchSettings.weights.creatorWeight,
          releaseInfoWeight: settings.searchSettings.weights.releaseInfoWeight,
          descriptionWeight: settings.searchSettings.weights.descriptionWeight,
        },
        stopWords: arrayToString(settings.searchSettings.stopWords),
        bannedDirectories: arrayToString(settings.searchSettings.bannedDirectories),
        bannedFiles: arrayToString(settings.searchSettings.bannedFiles),
      },
      appSettings: {
        setupCompleted: settings.appSettings.setupCompleted,
      },
      knownDevices: settings.knownDevices.map(device => ({
        deviceId: device.deviceId,
        videoSettings: {
          enableVideo: device.videoSettings.enableVideo,
          videoDeviceId: device.videoSettings.videoDeviceId,
        },
        connectionSettings: {
          connectionType: device.connectionSettings.connectionType,
          autoConnectEnabled: device.connectionSettings.autoConnectEnabled,
        },
      })),
    };
  }

  /**
   * Converts form value to Settings domain model
   */
  private formValueToSettings(formValue: ReturnType<FormGroup['getRawValue']>): Settings {
    return {
      playerSettings: {
        repeatModeOnStartup: formValue.playerSettings.repeatModeOnStartup,
        playTimerEnabled: formValue.playerSettings.playTimerEnabled,
        muteFastForward: formValue.playerSettings.muteFastForward,
        muteRandomSeek: formValue.playerSettings.muteRandomSeek,
        startupFilter: formValue.playerSettings.startupFilter,
        startupLaunchEnabled: formValue.playerSettings.startupLaunchEnabled,
        startupLaunchRandom: formValue.playerSettings.startupLaunchRandom,
      },
      fileTransferSettings: {
        watchDirectoryLocation: formValue.fileTransferSettings.watchDirectoryLocation,
        autoTransferPath: formValue.fileTransferSettings.autoTransferPath,
        autoFileCopyEnabled: formValue.fileTransferSettings.autoFileCopyEnabled,
        autoLaunchOnCopyEnabled: formValue.fileTransferSettings.autoLaunchOnCopyEnabled,
        navToDirOnLaunch: formValue.fileTransferSettings.navToDirOnLaunch,
        syncFilesEnabled: formValue.fileTransferSettings.syncFilesEnabled,
      },
      searchSettings: {
        weights: {
          nameWeight: formValue.searchSettings.weights.nameWeight,
          titleWeight: formValue.searchSettings.weights.titleWeight,
          creatorWeight: formValue.searchSettings.weights.creatorWeight,
          releaseInfoWeight: formValue.searchSettings.weights.releaseInfoWeight,
          descriptionWeight: formValue.searchSettings.weights.descriptionWeight,
        },
        stopWords: stringToArray(formValue.searchSettings.stopWords),
        bannedDirectories: stringToArray(formValue.searchSettings.bannedDirectories),
        bannedFiles: stringToArray(formValue.searchSettings.bannedFiles),
      },
      appSettings: {
        setupCompleted: formValue.appSettings.setupCompleted,
      },
      knownDevices: formValue.knownDevices.map((device: DeviceSettings) => ({
        deviceId: device.deviceId,
        videoSettings: {
          enableVideo: device.videoSettings.enableVideo,
          videoDeviceId: device.videoSettings.videoDeviceId,
        },
        connectionSettings: {
          connectionType: device.connectionSettings.connectionType,
          autoConnectEnabled: device.connectionSettings.autoConnectEnabled,
        },
      })),
    };
  }

  /**
   * Saves current form values to backend
   */
  async saveSettings(): Promise<void> {
    const form = this.settingsForm();
    if (!form || !form.valid) {
      return;
    }

    try {
      const formValue = form.getRawValue();
      const settings = this.formValueToSettings(formValue);

      // Update store state (adds to history)
      this.settingsStore.updateSettings({ settings });

      // Trigger backend save
      await this.settingsStore.saveSettings();
    } catch (error) {
      // Error is already handled by the store and set in error state
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Undo to previous settings state
   */
  undo(): void {
    if (this.canUndo()) {
      this.settingsStore.undo();
    }
  }

  /**
   * Redo to next settings state
   */
  redo(): void {
    if (this.canRedo()) {
      this.settingsStore.redo();
    }
  }

  /**
   * Helper method to get typed FormArray for known devices section
   */
  getKnownDevices(): FormArray {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('knownDevices') as FormArray;
  }

  /**
   * Helper method to get typed FormGroup for player settings section
   */
  getPlayerSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('playerSettings') as FormGroup;
  }

  /**
   * Helper method to get typed FormGroup for file transfer settings section
   */
  getFileTransferSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('fileTransferSettings') as FormGroup;
  }

  /**
   * Helper method to get typed FormGroup for search settings section
   */
  getSearchSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('searchSettings') as FormGroup;
  }

  /**
   * Helper method to get typed FormGroup for app settings section
   */
  getAppSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('appSettings') as FormGroup;
  }
}
