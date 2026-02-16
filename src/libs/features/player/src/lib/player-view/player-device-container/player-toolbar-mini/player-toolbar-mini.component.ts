import { Component, inject, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScalingCompactCardComponent,
  IconButtonComponent,
  IconButtonColor,
  SlidingContainerComponent,
  TooltipConfig,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT } from '@teensyrom-nx/application';
import { LaunchMode, PlayerStatus, FileItemType } from '@teensyrom-nx/domain';
import { ProgressBarComponent } from '../player-toolbar/progress-bar/progress-bar.component';
import { PlayerToolbarActionsComponent } from '../player-toolbar/player-toolbar-actions/player-toolbar-actions.component';
import { FileTimeComponent } from '../player-toolbar/file-time/file-time.component';

@Component({
  selector: 'lib-player-toolbar-mini',
  imports: [
    CommonModule,
    ScalingCompactCardComponent,
    IconButtonComponent,
    SlidingContainerComponent,
    ProgressBarComponent,
    PlayerToolbarActionsComponent,
    FileTimeComponent,
  ],
  templateUrl: './player-toolbar-mini.component.html',
  styleUrl: './player-toolbar-mini.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerToolbarMiniComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);

  deviceId = input.required<string>();

  previousTooltip = computed<TooltipConfig>(() => ({
    title: 'Previous',
    body: `Navigate to the previous file based on shuffle mode.\n
● Shuffle enabled: Launches previous file from launch history.
● Shuffle disabled: Launches previous file in directory order.`,
    position: TooltipPosition.Top,
  }));

  nextTooltip = computed<TooltipConfig>(() => ({
    title: 'Next',
    body: `Navigate to the next file based on shuffle mode.\n
● Shuffle enabled: Launches next random file or from history.
● Shuffle disabled: Launches next file in directory order.`,
    position: TooltipPosition.Top,
  }));

  readonly stopTooltip: TooltipConfig = {
    title: 'Stop',
    body: 'Stops the currently launched file by resetting TeensyROM.',
    position: TooltipPosition.Top,
  };

  readonly playPauseTooltip = computed<TooltipConfig>(() => ({
    title: this.getPlayPauseLabelComputed(),
    position: TooltipPosition.Top,
  }));

  timerState = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;

    void this.playerContext.getCurrentFile(deviceId)()?.file?.path;
    void this.playerContext.getPlayTimerConfig(deviceId)();

    const timerSignal = this.playerContext.getTimerState(deviceId);
    return timerSignal();
  });

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

  hasError = computed(() => this.playerContext.getError(this.deviceId())() !== null);

  isFileCompatible = computed(() => this.playerContext.isCurrentFileCompatible(this.deviceId())());

  showProgressBar = computed(() => {
    const state = this.timerState();
    return state !== null && state.showProgress;
  });

  currentTime = computed(() => {
    const state = this.timerState();
    if (state !== null) {
      return state.currentTime;
    }
    return 0;
  });

  totalTime = computed(() => {
    const state = this.timerState();
    if (state !== null) {
      return state.totalTime;
    }
    return 0;
  });

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
}
