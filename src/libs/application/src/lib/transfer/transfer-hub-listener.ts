import { Injectable, inject } from '@angular/core';
import { TRANSFER_HUB_SERVICE, ITransferHubService } from '@teensyrom-nx/domain';
import { TransferStore } from './transfer-store';
import { logInfo, logError, LogType } from '@teensyrom-nx/utils';

/**
 * Live transfer-hub coordination for this tab's own transfers — one job subscription per device.
 *
 * Joining a job's group keeps an own upload from being abandoned and seeds the store with the
 * job's current snapshot. The seed is folded like every other snapshot; the pushes that follow
 * arrive through `TransferTracker`, the one subscriber to the hub's snapshot stream.
 */
@Injectable({
  providedIn: 'root',
})
export class TransferHubListener {
  private readonly hubService: ITransferHubService = inject(TRANSFER_HUB_SERVICE);
  private readonly transferStore = inject(TransferStore);

  private readonly jobIdsByDevice = new Map<string, string>();

  /** Joins the job's group and folds its seed snapshot, leaving other devices' subscriptions alone. */
  async start(deviceId: string, jobId: string): Promise<void> {
    logInfo(LogType.Start, `TransferHubListener: Starting listener for device ${deviceId}, job ${jobId}`);

    if (this.jobIdsByDevice.has(deviceId)) {
      await this.stop(deviceId);
    }
    this.jobIdsByDevice.set(deviceId, jobId);

    const seedSnapshot = await this.hubService.subscribe(jobId);
    this.transferStore.foldLiveSnapshot({ snapshot: seedSnapshot });

    logInfo(
      LogType.Success,
      `TransferHubListener: Listener started for device ${deviceId}, job ${jobId}`
    );
  }

  /** Leaves the group of the job this device started; a no-op when it has none. */
  async stop(deviceId: string): Promise<void> {
    const jobId = this.jobIdsByDevice.get(deviceId);
    if (!jobId) {
      return;
    }
    this.jobIdsByDevice.delete(deviceId);

    try {
      await this.hubService.unsubscribe(jobId);
      logInfo(LogType.Finish, `TransferHubListener: Stopped listener for job ${jobId}`);
    } catch (error) {
      logError(`TransferHubListener: Failed to unsubscribe from job ${jobId}`, error);
    }
  }
}
