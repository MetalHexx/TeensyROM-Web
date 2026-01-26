import { Component, inject, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScalingCompactCardComponent,
  IconButtonComponent,
  IconButtonColor,
  SlidingContainerComponent,
} from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT } from '@teensyrom-nx/application';
import { LaunchMode, PlayerStatus, FileItemType } from '@teensyrom-nx/domain';
import { ProgressBarComponent } from './progress-bar/progress-bar.component';
import { FileInfoComponent } from './file-info/file-info.component';
import { FileTimeComponent } from './file-time/file-time.component';
import { PlayerToolbarActionsComponent } from './player-toolbar-actions/player-toolbar-actions.component';

@Component({
  selector: 'lib-player-toolbar',
  imports: [
    CommonModule,
    ScalingCompactCardComponent,
    IconButtonComponent,
    SlidingContainerComponent,
    ProgressBarComponent,
    FileInfoComponent,
    FileTimeComponent,
    PlayerToolbarActionsComponent,
  ],
  templateUrl: './player-toolbar.component.html',
  styleUrl: './player-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerToolbarComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);

  deviceId = input.required<string>();

  timerState = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    
    // Track file path to detect when files change and timer cache updates
    void this.playerContext.getCurrentFile(deviceId)()?.file?.path;
    
    const timerSignal = this.playerContext.getTimerState(deviceId);
    return timerSignal();
  });

  // Convert to computed for OnPush optimization
  isCurrentFileMusicTypeComputed = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return false;

    const currentFile = this.playerContext.getCurrentFile(deviceId)();
    return currentFile?.file?.type === FileItemType.Song;
  });

  canNavigateComputed = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return false;

    const fileContext = this.playerContext.getFileContext(deviceId)();
    const launchMode = this.playerContext.getLaunchMode(deviceId)();

    return (
      (fileContext !== null && fileContext.files.length > 1) || launchMode === LaunchMode.Shuffle
    );
  });

  canNavigatePreviousComputed = computed(() => this.canNavigateComputed());

  getPlayPauseIconComputed = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return 'play_arrow';

    const status = this.playerContext.getPlayerStatus(deviceId)();
    return status === PlayerStatus.Playing ? 'pause' : 'play_arrow';
  });

  getPlayPauseLabelComputed = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return 'Play';

    const status = this.playerContext.getPlayerStatus(deviceId)();
    return status === PlayerStatus.Playing ? 'Pause' : 'Play';
  });

  getPlayButtonColorComputed = computed<IconButtonColor>(() => {
    return !this.isFileCompatible() ? 'error' : 'normal';
  });

  isPlayerLoadedComputed = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return false;

    const currentFile = this.playerContext.getCurrentFile(deviceId)();
    return currentFile !== null;
  });

  isLoading(): boolean {
    const deviceId = this.deviceId();
    if (!deviceId) return false;

    return this.playerContext.isLoading(deviceId)();
  }

  // Phase 3: New playback control methods
  async playPause(): Promise<void> {
    const deviceId = this.deviceId();
    if (deviceId) {
      const status = this.playerContext.getPlayerStatus(deviceId)();

      if (status === PlayerStatus.Playing) {
        await this.playerContext.pause(deviceId);
      } else {
        await this.playerContext.play(deviceId);
      }
    }
  }

  async stop(): Promise<void> {
    const deviceId = this.deviceId();
    if (deviceId) {
      await this.playerContext.stop(deviceId);
    }
  }

  async next(): Promise<void> {
    const deviceId = this.deviceId();
    if (deviceId) {
      await this.playerContext.next(deviceId);
    }
  }

  async previous(): Promise<void> {
    const deviceId = this.deviceId();
    if (deviceId) {
      await this.playerContext.previous(deviceId);
    }
  }

  // UI helper methods - keep as methods for async operations
  // Template should use computed versions (with "Computed" suffix)
  getPlayerStatus(): PlayerStatus {
    const deviceId = this.deviceId();
    if (!deviceId) return PlayerStatus.Stopped;

    return this.playerContext.getPlayerStatus(deviceId)();
  }

  hasError = computed(() => this.playerContext.getError(this.deviceId())() !== null);

  isFileCompatible = computed(() => this.playerContext.isCurrentFileCompatible(this.deviceId())());

  // Phase 3: Custom timer config for demo purposes
  customTimerConfig = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    return this.playerContext.getPlayTimerConfig(deviceId)();
  });

  showProgressBar = computed(() => {
    const state = this.timerState();
    const customTimer = this.customTimerConfig();
    const currentFile = this.currentFile();
    
    // Show progress bar if Phase 5 timer is active OR custom timer is enabled (Phase 3 demo)
    if (state !== null && state.showProgress) {
      return true;
    }
    
    // Phase 3: Show progress bar when custom timer is enabled AND file is loaded
    // Don't show demo progress bar until a file is actually playing
    return customTimer !== null && customTimer.enabled && currentFile !== null;
  });

  currentTime = computed(() => {
    const state = this.timerState();
    const customTimer = this.customTimerConfig();
    const hasError = this.hasError();
    
    // Use Phase 5 timer if available
    if (state !== null) {
      return state.currentTime;
    }
    
    // Don't show progress if there's an error (failed launch)
    if (hasError) {
      return 0;
    }
    
    // Phase 3 demo: Show half of custom timer duration
    if (customTimer !== null && customTimer.enabled) {
      return Math.floor(customTimer.durationMs / 2);
    }
    
    return 0;
  });
  
  totalTime = computed(() => {
    const state = this.timerState();
    const customTimer = this.customTimerConfig();
    const hasError = this.hasError();
    
    // Use Phase 5 timer if available
    if (state !== null) {
      return state.totalTime;
    }
    
    // Don't show progress if there's an error (failed launch)
    if (hasError) {
      return 0;
    }
    
    // Phase 3 demo: Show custom timer duration
    if (customTimer !== null && customTimer.enabled) {
      return customTimer.durationMs;
    }
    
    return 0;
  });

  // Current file for file-info component
  currentFile = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    return this.playerContext.getCurrentFile(deviceId)();
  });
}
