import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  ALERT_SERVICE,
  IAlertService,
  TRANSFER_HUB_SERVICE,
  ITransferHubService,
  TransferJobSnapshot,
  TransferLaunchState,
} from '@teensyrom-nx/domain';
import { logError, logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { DeviceStore } from '../device/device-store';
import { TransferStore } from './transfer-store';
import { TransferContextService } from './transfer-context.service';
import { isTerminalJobState } from './transfer-helpers';
import { isLiveEntry } from './selectors/get-live-transfers';
import { buildEndAnnouncement, buildStartAnnouncement } from './transfer-announcements';

/** How long to wait before trying the all-transfers subscription again after it failed. */
const SUBSCRIBE_RETRY_MS = 10_000;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Follows every transfer on every device — this tab's own, other tabs', and watch folders' —
 * through the hub's all-transfers group. It is the one subscriber to the hub's snapshot stream:
 * each snapshot is folded into `TransferStore` under a single set of rules, and each transfer
 * raises one start alert and one end alert.
 *
 * Pushes and lists are handled one at a time, in arrival order.
 */
@Injectable({ providedIn: 'root' })
export class TransferTracker {
  private readonly hubService: ITransferHubService = inject(TRANSFER_HUB_SERVICE);
  private readonly alertService: IAlertService = inject(ALERT_SERVICE);
  private readonly store = inject(TransferStore);
  private readonly deviceStore = inject(DeviceStore);
  private readonly transferContext = inject(TransferContextService);

  private readonly startAnnounced = new Set<string>();
  private readonly endAnnounced = new Set<string>();
  private subscriptions: Subscription[] = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private startPromise: Promise<void> | null = null;
  private running = false;
  private seeded = false;
  private queue: Promise<void> = Promise.resolve();

  /**
   * Joins the all-transfers group, seeds the store from its list without start alerts, and folds
   * every push. Idempotent. A failed first subscription is retried until it succeeds.
   */
  start(): Promise<void> {
    if (!this.startPromise) {
      this.running = true;
      this.startPromise = this.run();
    }
    return this.startPromise;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.startPromise = null;
    this.seeded = false;
    this.clearRetry();
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
    this.startAnnounced.clear();
    this.endAnnounced.clear();

    try {
      await this.hubService.unsubscribeAll();
    } catch (error) {
      logWarn(`TransferTracker: Failed to leave the all-transfers group - ${describe(error)}`);
    }
  }

  private async run(): Promise<void> {
    // Subscribed before the join so nothing a connection delivers meanwhile is missed, and so a
    // later connection that rejoins the group on its own is heard too.
    this.subscriptions = [
      this.hubService.snapshots$.subscribe((snapshot) =>
        this.enqueue(() => this.handle(snapshot))
      ),
      this.hubService.allResynced$.subscribe((list) => this.enqueue(() => this.handleList(list))),
    ];

    await this.join();
  }

  private async join(): Promise<void> {
    this.retryTimer = null;
    try {
      const list = await this.hubService.subscribeAll();
      if (!this.running) {
        return;
      }
      await this.enqueue(() => this.handleList(list));
      logInfo(LogType.Success, 'TransferTracker: Subscribed to all transfers');
    } catch (error) {
      if (!this.running) {
        return;
      }
      logWarn(
        `TransferTracker: Could not subscribe to all transfers, retrying in ${SUBSCRIBE_RETRY_MS / 1000}s - ${describe(error)}`
      );
      this.retryTimer = setTimeout(() => void this.join(), SUBSCRIBE_RETRY_MS);
    }
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task).catch((error) => {
      logError('TransferTracker: Failed to process a transfer update', error);
    });
    this.queue = run;
    return run;
  }

  private async handleList(list: TransferJobSnapshot[]): Promise<void> {
    if (this.seeded) {
      await this.resync(list);
    } else {
      this.seed(list);
    }
  }

  /** Folds what is running, quietly: a job already under way is not announced as starting. */
  private seed(list: TransferJobSnapshot[]): void {
    this.seeded = true;
    for (const snapshot of [...list].reverse()) {
      if (isTerminalJobState(snapshot.state)) {
        this.endAnnounced.add(snapshot.jobId);
      } else {
        this.startAnnounced.add(snapshot.jobId);
        this.store.foldLiveSnapshot({ snapshot });
      }
    }
  }

  /** Reconciles the store with the full list a reconnect returns, announcing what was missed. */
  private async resync(list: TransferJobSnapshot[]): Promise<void> {
    for (const snapshot of [...list].reverse()) {
      const { jobId } = snapshot;
      if (!isTerminalJobState(snapshot.state) || this.startAnnounced.has(jobId)) {
        await this.handle(snapshot);
      } else {
        // Ended before this tab ever saw it; nothing to announce.
        this.endAnnounced.add(jobId);
      }
    }

    const listedJobIds = new Set(list.map((snapshot) => snapshot.jobId));
    for (const entry of Object.values(this.store.transfers())) {
      if (isLiveEntry(entry) && entry.job && !listedJobIds.has(entry.job.jobId)) {
        // It ended and was evicted during the gap.
        await this.dropEntry(entry.deviceId);
      }
    }
  }

  private async handle(snapshot: TransferJobSnapshot): Promise<void> {
    const { jobId, deviceId } = snapshot;
    if (this.endAnnounced.has(jobId)) {
      return;
    }

    const terminal = isTerminalJobState(snapshot.state);
    const firstSeen = !this.startAnnounced.has(jobId);

    await this.releaseEndedOwnRecords(snapshot);
    this.store.foldLiveSnapshot({ snapshot });

    if (!terminal) {
      if (firstSeen) {
        this.startAnnounced.add(jobId);
        this.announceStart(snapshot);
      }
      return;
    }

    // The end alert reports the launch, so it waits for the launch to settle.
    if (snapshot.launchState === TransferLaunchState.Pending) {
      return;
    }

    this.endAnnounced.add(jobId);
    const { severity, message } = buildEndAnnouncement(snapshot, this.deviceName(deviceId));
    this.alertService[severity](message);

    // Not the entry of a newer job on the device, and not one the dialog is showing: that one
    // goes when the dialog is closed or hidden.
    const entry = this.store.transfers()[deviceId];
    if (entry?.job?.jobId === jobId && this.store.detailsDeviceId() !== deviceId) {
      await this.dropEntry(deviceId);
    }
  }

  /** An own entry whose job ended is about to give way to a newer job: let go of its records first. */
  private async releaseEndedOwnRecords(snapshot: TransferJobSnapshot): Promise<void> {
    const entry = this.store.transfers()[snapshot.deviceId];
    const job = entry?.job;
    if (
      entry?.startedHere &&
      job &&
      isTerminalJobState(job.state) &&
      job.jobId !== snapshot.jobId &&
      snapshot.startedUtc.getTime() >= job.startedUtc.getTime()
    ) {
      await this.transferContext.releaseOwnRecords(snapshot.deviceId);
    }
  }

  private async dropEntry(deviceId: string): Promise<void> {
    if (this.store.transfers()[deviceId]?.startedHere) {
      await this.transferContext.closeTransfer(deviceId);
    } else {
      this.store.clearTransfer({ deviceId });
    }
  }

  private announceStart(snapshot: TransferJobSnapshot): void {
    const entry = this.store.transfers()[snapshot.deviceId];
    // Only the own drop knows its count before the engine does: its create is still in flight, or
    // it is already this job.
    const isOwnDrop =
      entry?.startedHere === true &&
      (entry.phase === 'starting' || entry.job?.jobId === snapshot.jobId);
    const { severity, message } = buildStartAnnouncement(
      snapshot,
      this.deviceName(snapshot.deviceId),
      isOwnDrop ? entry.scanTotal : undefined
    );
    this.alertService[severity](message);
  }

  private deviceName(deviceId: string): string {
    return this.deviceStore.devices().find((device) => device.deviceId === deviceId)?.name || deviceId;
  }
}
