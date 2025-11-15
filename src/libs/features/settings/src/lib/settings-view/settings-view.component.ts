import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
  signal,
  effect,
  HostListener,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs/operators';
import { SettingsStore } from '@teensyrom-nx/application';
import { Settings } from '@teensyrom-nx/domain';
import { arrayToString, stringToArray } from '@teensyrom-nx/utils';
import { LoadingTextComponent } from '@teensyrom-nx/ui/components';
import { ConnectionSettingsSectionComponent } from './connection-settings-section/connection-settings-section.component';
import { PlayerSettingsSectionComponent } from './player-settings-section/player-settings-section.component';
import { FileTransferSettingsSectionComponent } from './file-transfer-settings-section/file-transfer-settings-section.component';
import { SearchSettingsSectionComponent } from './search-settings-section/search-settings-section.component';
import { AppSettingsSectionComponent } from './app-settings-section/app-settings-section.component';

@Component({
  selector: 'lib-settings-view',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatTabsModule,
    LoadingTextComponent,
    ConnectionSettingsSectionComponent,
    PlayerSettingsSectionComponent,
    FileTransferSettingsSectionComponent,
    SearchSettingsSectionComponent,
    AppSettingsSectionComponent,
  ],
  templateUrl: './settings-view.component.html',
  styleUrl: './settings-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsViewComponent {
  private readonly settingsStore = inject(SettingsStore);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly settings = this.settingsStore.getSettings();
  readonly isLoading = this.settingsStore.isLoading;
  readonly error = this.settingsStore.error;

  readonly formattedJson = computed(() => {
    const settings = this.settings();
    return settings ? JSON.stringify(settings, null, 2) : null;
  });

  /**
   * Main settings form signal
   */
  readonly settingsForm = signal<FormGroup | null>(null);

  /**
   * Auto-save toggle state (enabled by default)
   */
  readonly autoSaveEnabled = signal<boolean>(true);

  /**
   * Computed: whether settings are currently being saved
   */
  readonly isSaving = computed(() => this.settingsStore.isSaving());

  /**
   * Computed: whether manual save is allowed
   */
  readonly canSave = computed(() => {
    const form = this.settingsForm();
    return form !== null && form.valid && !this.isSaving();
  });

  /**
   * Flag to prevent auto-save when syncing form from store (undo/redo)
   */
  readonly isSyncingFromStore = signal<boolean>(false);

  /**
   * Computed: whether undo is available
   */
  readonly canUndo = computed(() => this.settingsStore.history().length > 0);

  /**
   * Computed: whether redo is available
   */
  readonly canRedo = computed(() => {
    const position = this.settingsStore.historyPosition();
    const historyLength = this.settingsStore.history().length;
    return position !== -1 && position < historyLength - 1;
  });

  /**
   * Helper methods to get typed FormGroups for each settings section
   */
  getConnectionSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('connectionSettings') as FormGroup;
  }

  getPlayerSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('playerSettings') as FormGroup;
  }

  getFileTransferSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('fileTransferSettings') as FormGroup;
  }

  getSearchSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('searchSettings') as FormGroup;
  }

  getAppSettings(): FormGroup {
    const form = this.settingsForm();
    if (!form) {
      throw new Error('Settings form not initialized');
    }
    return form.get('appSettings') as FormGroup;
  }

  constructor() {
    // Initialize form when settings load
    effect(() => {
      const settings = this.settings();
      if (settings && !this.settingsForm()) {
        const form = this.buildForm(settings);
        this.settingsForm.set(form);
      }
    });

    // Setup auto-save on form value changes
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

    // Sync form when settings change (from undo/redo or external updates)
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
   * Handles Ctrl+Z keyboard shortcut for undo
   */
  @HostListener('window:keydown.control.z', ['$event'])
  onUndoShortcut(event: Event): void {
    if (this.canUndo()) {
      event.preventDefault();
      this.undo();
    }
  }

  /**
   * Handles Ctrl+Y keyboard shortcut for redo
   */
  @HostListener('window:keydown.control.y', ['$event'])
  onRedoShortcut(event: Event): void {
    if (this.canRedo()) {
      event.preventDefault();
      this.redo();
    }
  }

  /**
   * Builds the complete reactive form structure matching the Settings domain model
   */
  private buildForm(settings: Settings): FormGroup {
    return this.fb.group({
      connectionSettings: this.fb.group({
        connectionType: [settings.connectionSettings.connectionType, Validators.required],
        autoConnectEnabled: [settings.connectionSettings.autoConnectEnabled],
      }),
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
      connectionSettings: {
        connectionType: settings.connectionSettings.connectionType,
        autoConnectEnabled: settings.connectionSettings.autoConnectEnabled,
      },
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
    };
  }

  /**
   * Converts form value to Settings domain model
   */
  private formValueToSettings(formValue: ReturnType<FormGroup['getRawValue']>): Settings {
    return {
      connectionSettings: {
        connectionType: formValue.connectionSettings.connectionType,
        autoConnectEnabled: formValue.connectionSettings.autoConnectEnabled,
      },
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
}
