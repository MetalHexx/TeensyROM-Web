import { Component, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IconButtonComponent, DropdownMenuComponent, DropdownMenuItemComponent } from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT, StorageStore } from '@teensyrom-nx/application';
import { LaunchMode } from '@teensyrom-nx/domain';
import { StorageKeyUtil } from '@teensyrom-nx/application';

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
    MatBadgeModule,
    MatTooltipModule,
    IconButtonComponent,
    DropdownMenuComponent,
    DropdownMenuItemComponent,
  ],
  templateUrl: './player-toolbar-actions.component.html',
  styleUrl: './player-toolbar-actions.component.scss',
})
export class PlayerToolbarActionsComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);
  private readonly storageStore = inject(StorageStore);

  deviceId = input.required<string>();

  protected readonly durationOptions = DURATION_OPTIONS;

  customTimerConfig = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    return this.playerContext.getPlayTimerConfig(deviceId)();
  });

  isCustomTimerEnabled = computed(() => {
    const config = this.customTimerConfig();
    return config?.enabled ?? false;
  });

  selectedDurationMs = computed(() => {
    const config = this.customTimerConfig();
    return config?.durationMs ?? 180000;
  });

  timerBadgeText = computed(() => {
    const durationMs = this.selectedDurationMs();
    const option = DURATION_OPTIONS.find(opt => opt.valueMs === durationMs);
    return option?.label ?? '3m';
  });


  currentFile = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) {
      return null;
    }
    const file = this.playerContext.getCurrentFile(deviceId)();
    return file;
  });

  isFavorite = computed(() => {
    const launchedFile = this.currentFile();
    const result = launchedFile?.file?.isFavorite ?? false;
    console.log('[isFavorite] Computed evaluated:', result, 'file:', launchedFile?.file.path);
    return result;
  });

  favoriteIconClass = computed(() => {
    const result = this.isFavorite() ? 'filled' : 'outlined';
    console.log('[favoriteIconClass] Computed evaluated:', result);
    return result;
  });

  onTimerMenuItemClick(durationMs: number | null): void {
    const deviceId = this.deviceId();
    if (!deviceId) return;

    if (durationMs === null) {
      // "Off" selected - disable timer, preserve current duration
      const currentDuration = this.selectedDurationMs();
      this.playerContext.setCustomTimer(deviceId, false, currentDuration);
    } else {
      // Duration selected - enable timer with selected duration
      this.playerContext.setCustomTimer(deviceId, true, durationMs);
    }
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

    if (favoriteState.error) {
      return;
    }

    this.playerContext.updateCurrentFileFavoriteStatus(deviceId, filePath, newFavoriteStatus);
  }

  isFavoriteOperationInProgress(): boolean {
    return this.storageStore.favoriteOperationsState().isProcessing;
  }
}
