import { Component, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IconButtonComponent, DropdownMenuComponent, DropdownMenuItemComponent, TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT, StorageStore } from '@teensyrom-nx/application';
import { LaunchMode } from '@teensyrom-nx/domain';
import { StorageKeyUtil } from '@teensyrom-nx/application';

const DURATION_OPTIONS = [
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

  timerTooltip = computed<TooltipConfig>(() => {    
    return {
      title: this.isCustomTimerEnabled() ? 'Disable Play Timer' : 'Enable Play Timer',
      body: 'Set a play timer to allow games, demos and images to continuously play in a stream.  SID durations are unaffected.',
      position: TooltipPosition.Top
    };
  });

  timerAriaLabel = computed(() => {
    const baseText = this.isCustomTimerEnabled() ? 'Disable Play Timer' : 'Enable Play Timer';
    if (this.isCustomTimerEnabled()) {
      const durationLabel = this.timerBadgeText();
      return `${baseText} - ${durationLabel}`;
    }
    return baseText;
  });

  shuffleTooltip = computed<TooltipConfig>(() => ({
    title: 'Shuffle Mode',
    body: `Shuffle mode randomizes file launches and affects the behavior of the Next/Previous buttons.\n
    ● Enabled: Next/Previous launches random files.
    ● Disabled: Next/Previous launches files in directory order.
    ● All launches, regardless of mode, are tracked in launch history.`,
    position: TooltipPosition.Top
  }));

  favoriteTooltip = computed<TooltipConfig>(() => ({
    title: this.isFavorite() ? 'Untag Favorite' : 'Tag Favorite',
    body: this.isFavorite() 
      ? '● Removes the file from the /favorites directory.\n● TeensyROM will reset if a game or program is currently running.' 
      : '● Places a copy of the file in the /favorites directory.\n● TeensyROM will reset if a game or program is currently running.',
    position: TooltipPosition.Top
  }));

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
