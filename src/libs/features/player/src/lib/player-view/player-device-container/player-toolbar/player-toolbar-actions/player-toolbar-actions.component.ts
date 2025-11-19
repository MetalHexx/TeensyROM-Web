import { Component, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IconButtonComponent } from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT, StorageStore } from '@teensyrom-nx/application';
import { LaunchMode } from '@teensyrom-nx/domain';
import { StorageKeyUtil } from '@teensyrom-nx/application';

/**
 * Predefined duration options for custom play timer.
 * Each option provides a label for display and a value in milliseconds.
 * Options range from 5 seconds to 1 hour in ascending order.
 */
const DURATION_OPTIONS = [
  { label: '5s', valueMs: 5000 },
  { label: '10s', valueMs: 10000 },
  { label: '15s', valueMs: 15000 },
  { label: '30s', valueMs: 30000 },
  { label: '1m', valueMs: 60000 },
  { label: '3m', valueMs: 180000 },
  { label: '5m', valueMs: 300000 },
  { label: '10m', valueMs: 600000 },
  { label: '30m', valueMs: 1800000 },
  { label: '1h', valueMs: 3600000 },
] as const;

@Component({
  selector: 'lib-player-toolbar-actions',
  imports: [
    CommonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    IconButtonComponent,
  ],
  templateUrl: './player-toolbar-actions.component.html',
  styleUrl: './player-toolbar-actions.component.scss',
})
export class PlayerToolbarActionsComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);
  private readonly storageStore = inject(StorageStore);

  deviceId = input.required<string>();

  /**
   * Expose duration options for template usage
   */
  protected readonly durationOptions = DURATION_OPTIONS;

  /**
   * Custom timer configuration for the current device.
   * Returns null if no custom timer config exists.
   */
  customTimerConfig = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    return this.playerContext.getPlayTimerConfig(deviceId)();
  });

  /**
   * Whether custom timer is currently enabled for this device.
   * Defaults to false when config is null.
   */
  isCustomTimerEnabled = computed(() => {
    const config = this.customTimerConfig();
    return config?.enabled ?? false;
  });

  /**
   * Currently selected timer duration in milliseconds.
   * Defaults to 3 minutes (180000ms) when config is null.
   */
  selectedDurationMs = computed(() => {
    const config = this.customTimerConfig();
    return config?.durationMs ?? 180000;
  });

  currentFile = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    // Invoke the inner signal to subscribe to store changes
    return this.playerContext.getCurrentFile(deviceId)();
  });

  /**
   * Toggles the custom timer enabled state.
   * Preserves the current duration when toggling.
   */
  onTimerToggle(): void {
    const deviceId = this.deviceId();
    if (!deviceId) return;

    const currentEnabled = this.isCustomTimerEnabled();
    const currentDuration = this.selectedDurationMs();

    this.playerContext.setCustomTimer(deviceId, !currentEnabled, currentDuration);
  }

  /**
   * Updates the timer duration.
   * Keeps the timer enabled when changing duration.
   */
  onDurationChange(newDurationMs: number): void {
    const deviceId = this.deviceId();
    if (!deviceId) return;

    this.playerContext.setCustomTimer(deviceId, true, newDurationMs);
  }

  toggleShuffleMode(): void {
    const deviceId = this.deviceId();
    if (deviceId) {
      this.playerContext.toggleShuffleMode(deviceId);
    }
  }

  isShuffleMode(): boolean {
    const deviceId = this.deviceId();
    if (!deviceId) return false;

    return this.playerContext.getLaunchMode(deviceId)() === LaunchMode.Shuffle;
  }

  async toggleFavorite(): Promise<void> {
    if (this.isFavoriteOperationInProgress()) {
      return;
    }

    const launchedFile = this.currentFile();
    if (!launchedFile) {
      return;
    }

    const file = launchedFile.file;
    const { deviceId, storageType } = StorageKeyUtil.parse(launchedFile.storageKey);
    const isCurrentlyFavorite = file?.isFavorite ?? false;
    const filePath = file.path;
    const newFavoriteStatus = !isCurrentlyFavorite;

    // PESSIMISTIC UPDATE: Wait for storage operation, then update player store
    if (isCurrentlyFavorite) {
      await this.storageStore.removeFavorite({
        deviceId,
        storageType,
        filePath,
      });
    } else {
      await this.storageStore.saveFavorite({
        deviceId,
        storageType,
        filePath,
      });
    }

    const favoriteState = this.storageStore.favoriteOperationsState();

    if (favoriteState.isProcessing || favoriteState.error) {
      return;
    }

    this.playerContext.updateCurrentFileFavoriteStatus(deviceId, filePath, newFavoriteStatus);
  }

  isFavorite(): boolean {
    const launchedFile = this.currentFile();
    return launchedFile?.file?.isFavorite ?? false;
  }

  isFavoriteOperationInProgress(): boolean {
    return this.storageStore.favoriteOperationsState().isProcessing;
  }
}
