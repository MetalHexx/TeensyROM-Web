import { Injectable, effect, inject } from '@angular/core';
import { PlayerStore } from '../player/player-store';
import { PlayerTimerManager } from '../player/player-timer-manager';
import { TransferStore } from './transfer-store';
import { logInfo, LogType } from '@teensyrom-nx/utils';

/**
 * Suppresses player timers for any device with an active transfer job.
 *
 * The transfer pump resets the device server-side before the first file arrives, so playback is
 * already stopped there. This reacts to `TransferStore` state alone — never to the drop flow — so
 * it also covers a job this client did not start (the busy pre-check finding a foreign job). It
 * issues no device command at any point; `reflectTransferStopped` is a local-only status write.
 */
@Injectable({ providedIn: 'root' })
export class TransferPlaybackGuard {
  private readonly transferStore = inject(TransferStore);
  private readonly playerStore = inject(PlayerStore);
  private readonly playerTimerManager = inject(PlayerTimerManager);

  /** Devices currently suppressed, so a gain/loss transition is only acted on once. */
  private readonly suppressedDevices = new Set<string>();

  constructor() {
    effect(() => {
      const transfers = this.transferStore.transfers();

      for (const deviceId of Object.keys(transfers)) {
        const transfer = transfers[deviceId];
        const hasActiveJob = transfer.phase === 'running' || transfer.activeForeignJobId !== null;

        if (hasActiveJob) {
          if (!this.suppressedDevices.has(deviceId)) {
            this.suppressedDevices.add(deviceId);
            logInfo(
              LogType.Info,
              `TransferPlaybackGuard: Halting player timer for device ${deviceId} — active transfer job`
            );

            this.playerTimerManager.destroyTimer(deviceId);
            this.playerStore.reflectTransferStopped({ deviceId });
          }
        } else if (this.suppressedDevices.has(deviceId)) {
          this.suppressedDevices.delete(deviceId);
          logInfo(
            LogType.Info,
            `TransferPlaybackGuard: Device ${deviceId} lost its active transfer job — resuming normal playback behavior`
          );
        }
      }
    });
  }
}
