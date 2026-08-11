import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TRANSFER_HUB_SERVICE, ITransferHubService } from '@teensyrom-nx/domain';
import { TransferStore } from './transfer-store';
import { logInfo, logError, LogType } from '@teensyrom-nx/utils';

/**
 * Live transfer-hub coordination for the single in-flight transfer.
 *
 * Joins a job's SignalR group, seeds the store from the server's current snapshot, and folds
 * every subsequent snapshot push into the `TransferStore` until stopped.
 */
@Injectable({
  providedIn: 'root',
})
export class TransferHubListener {
  private readonly hubService: ITransferHubService = inject(TRANSFER_HUB_SERVICE);
  private readonly transferStore = inject(TransferStore);

  private jobId: string | null = null;
  private subscriptions: Subscription[] = [];

  /** Subscribes to the job group, seeds the store, and folds the hub's live streams into it. */
  async start(deviceId: string, jobId: string): Promise<void> {
    logInfo(LogType.Start, `TransferHubListener: Starting listener for device ${deviceId}, job ${jobId}`);

    await this.stop();

    this.jobId = jobId;

    const seedSnapshot = await this.hubService.subscribe(jobId);
    this.transferStore.applyJobSnapshot({ deviceId, snapshot: seedSnapshot });

    const snapshotSubscription = this.hubService.snapshots$.subscribe((snapshot) => {
      this.transferStore.applyJobSnapshot({ deviceId, snapshot });
    });

    this.subscriptions = [snapshotSubscription];

    logInfo(
      LogType.Success,
      `TransferHubListener: Listener started for device ${deviceId}, job ${jobId}`
    );
  }

  /** Unsubscribes from the job group and tears down the fold subscriptions. */
  async stop(): Promise<void> {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];

    if (!this.jobId) {
      return;
    }

    const jobId = this.jobId;
    this.jobId = null;

    try {
      await this.hubService.unsubscribe(jobId);
      logInfo(LogType.Finish, `TransferHubListener: Stopped listener for job ${jobId}`);
    } catch (error) {
      logError(`TransferHubListener: Failed to unsubscribe from job ${jobId}`, error);
    }
  }
}
