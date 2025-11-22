import { Component, inject, input, computed, effect, Signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScalingCompactCardComponent,
  IconButtonComponent,
  IconButtonColor,
  SlidingContainerComponent,
} from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT, TimerState } from '@teensyrom-nx/application';
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
})
export class PlayerToolbarComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);

  deviceId = input.required<string>();

  // Phase 5: Timer state - computed to react to device ID changes
  // getTimerState() returns a Signal, and we need to switch between device signals
  // We call getTimerState() in a computed but immediately read its value
  // This is safe because getTimerState internally caches the toSignal call per device
  timerState = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    
    // getTimerState returns Signal<TimerState | null>, call it to get current value
    const timerSignal = this.playerContext.getTimerState(deviceId);
    return timerSignal();
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

  // UI helper methods for button display logic
  getPlayPauseIcon(): string {
    const deviceId = this.deviceId();
    if (!deviceId) return 'play_arrow';

    const status = this.playerContext.getPlayerStatus(deviceId)();
    return status === PlayerStatus.Playing ? 'pause' : 'play_arrow';
  }

  getPlayPauseLabel(): string {
    const deviceId = this.deviceId();
    if (!deviceId) return 'Play';

    const status = this.playerContext.getPlayerStatus(deviceId)();
    return status === PlayerStatus.Playing ? 'Pause' : 'Play';
  }

  isCurrentFileMusicType(): boolean {
    const deviceId = this.deviceId();
    if (!deviceId) return false;

    const currentFile = this.playerContext.getCurrentFile(deviceId)();
    return currentFile?.file?.type === FileItemType.Song;
  }

  canNavigate(): boolean {
    const deviceId = this.deviceId();
    if (!deviceId) return false;

    const fileContext = this.playerContext.getFileContext(deviceId)();
    const launchMode = this.playerContext.getLaunchMode(deviceId)();

    // Can navigate if we have file context (directory mode) or are in shuffle mode
    return (
      (fileContext !== null && fileContext.files.length > 1) || launchMode === LaunchMode.Shuffle
    );
  }

  canNavigatePrevious(): boolean {
    // Same logic as canNavigate for now - in shuffle mode, previous launches another random file
    return this.canNavigate();
  }

  getPlayerStatus(): PlayerStatus {
    const deviceId = this.deviceId();
    if (!deviceId) return PlayerStatus.Stopped;

    return this.playerContext.getPlayerStatus(deviceId)();
  }

  isPlayerLoaded(): boolean {
    const deviceId = this.deviceId();
    if (!deviceId) return false;

    const currentFile = this.playerContext.getCurrentFile(deviceId)();
    return currentFile !== null;
  }

  hasError = computed(() => this.playerContext.getError(this.deviceId())() !== null);

  isFileCompatible = computed(() => this.playerContext.isCurrentFileCompatible(this.deviceId())());

  getPlayButtonColor(): IconButtonColor {
    // Only show error (red) on play button when file is incompatible
    return !this.isFileCompatible() ? 'error' : 'normal';
  }

  // Phase 5: Timer state for progress bar  
  // Read from the cached signal (initialized in constructor effect)
  timerState = computed(() => this._cachedTimerSignal ? this._cachedTimerSignal() : null);

  // Phase 3: Custom timer config for demo purposes
  customTimerConfig = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    return this.playerContext.getPlayTimerConfig(deviceId)();
  });

  showProgressBar = computed(() => {
    const state = this.timerState();
    const customTimer = this.customTimerConfig();
    
    // Show progress bar if Phase 5 timer is active OR custom timer is enabled (Phase 3 demo)
    if (state !== null && state.showProgress) {
      return true;
    }
    
    // Phase 3: Show progress bar when custom timer is enabled (for demo/testing)
    return customTimer !== null && customTimer.enabled;
  });

  currentTime = computed(() => {
    const state = this.timerState();
    const customTimer = this.customTimerConfig();
    
    // Use Phase 5 timer if available
    if (state !== null) {
      return state.currentTime;
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
    
    // Use Phase 5 timer if available
    if (state !== null) {
      return state.totalTime;
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
