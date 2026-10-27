import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SettingsStore, WatchFolderStore } from '@teensyrom-nx/application';
import { WatchFolder, WatchFolderState } from '@teensyrom-nx/domain';
import { IconButtonComponent, SidePanelComponent } from '@teensyrom-nx/ui/components';
import { WatchFolderRowComponent } from './watch-folder-row/watch-folder-row.component';
import { WatchFolderDeviceRowComponent } from './watch-folder-device-row/watch-folder-device-row.component';

/**
 * The File Transfer view side panel: the global auto-launch switch and the list of watch folders
 * with their devices. It reloads the list every time it opens, since the engine can change
 * folders while the panel is closed. Rows are presentational; this container owns the store calls.
 */
@Component({
  selector: 'lib-transfer-settings-panel',
  imports: [
    MatSlideToggleModule,
    SidePanelComponent,
    IconButtonComponent,
    WatchFolderRowComponent,
    WatchFolderDeviceRowComponent,
  ],
  templateUrl: './transfer-settings-panel.component.html',
  styleUrl: './transfer-settings-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferSettingsPanelComponent {
  private readonly settingsStore = inject(SettingsStore);
  private readonly watchFolderStore = inject(WatchFolderStore);

  private readonly globalSwitch = viewChild<MatSlideToggle>('globalSwitch');

  /** Whether the panel is open; the list reloads each time this becomes true. */
  readonly open = input(false);
  /** Duration in milliseconds of the panel card own entry; `0` for reduced motion. */
  readonly animationDuration = input(400);

  /** Emits when the panel close button is pressed. */
  readonly closePanel = output<void>();
  /** Emits when the add folder button is pressed. */
  readonly addFolder = output<void>();
  /** Emits the folder id when its Add device link is pressed. */
  readonly addDevice = output<string>();
  /** Emits the folder and device ids when a device edit button is pressed. */
  readonly editDevice = output<{ watchFolderId: string; deviceId: string }>();

  protected readonly WatchFolderState = WatchFolderState;

  protected readonly folders = this.watchFolderStore.getFolders();
  protected readonly error = this.watchFolderStore.error;
  protected readonly isLoading = this.watchFolderStore.isLoading;

  private readonly settings = this.settingsStore.getSettings();
  protected readonly settingsReady = computed(() => this.settings() !== null);
  protected readonly autoLaunch = computed(
    () => this.settings()?.fileTransferSettings.autoLaunchOnCopyEnabled ?? false
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => void this.watchFolderStore.loadWatchFolders());
      }
    });
  }

  /** Moves keyboard focus to the Global switch. */
  focusEntry(): void {
    this.globalSwitch()?.focus();
  }

  protected async onAutoLaunchChange(checked: boolean): Promise<void> {
    this.settingsStore.updateSettings({
      settings: { fileTransferSettings: { autoLaunchOnCopyEnabled: checked } },
    });
    await this.settingsStore.saveSettings();
  }

  protected isPending(watchFolderId: string): boolean {
    return this.watchFolderStore.isPending(watchFolderId)();
  }

  protected isDimmed(folder: WatchFolder): boolean {
    return folder.state === WatchFolderState.Off;
  }

  protected onEnabledChange(watchFolderId: string, enabled: boolean): void {
    void this.watchFolderStore.setFolderEnabled({ watchFolderId, enabled });
  }

  protected onDeleteFolder(watchFolderId: string): void {
    void this.watchFolderStore.removeFolder({ watchFolderId });
  }

  protected onDeleteDevice(watchFolderId: string, deviceId: string): void {
    void this.watchFolderStore.removeDestination({ watchFolderId, deviceId });
  }
}
