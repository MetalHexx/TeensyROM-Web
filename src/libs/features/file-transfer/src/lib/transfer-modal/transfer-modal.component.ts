import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '@teensyrom-nx/ui/components';
import {
  DeviceStore,
  formatElapsedLabel,
  ITransferContext,
  TRANSFER_CONTEXT,
  TransferModalState,
  TransferStore,
} from '@teensyrom-nx/application';
import { TransferProgressComponent, TransferProgressVm } from './transfer-progress/transfer-progress.component';

/**
 * The dropzone card's file picker button — the focus-return anchor for a drop, which is a
 * pointer gesture with no focused element of its own to return to.
 */
const DROPZONE_PICKER_BUTTON_SELECTOR = '[data-testid="dropzone-choose-files"]';

/** Once the modal reaches one of these, the elapsed ticker stops advancing. */
const TERMINAL_MODAL_STATES = new Set<TransferModalState>(['completed', 'cancelled', 'aborted', 'abandoned']);

/**
 * Thin host that binds `TransferStore` state to `TransferProgressComponent`. Owns no metric
 * arithmetic — every view-model field is read straight from a selector — and owns exactly the
 * three side effects the presentational component can't: cancel's confirm-before-abort gate,
 * retry, and closing itself out through `ITransferContext`.
 */
@Component({
  selector: 'lib-transfer-modal',
  imports: [TransferProgressComponent],
  templateUrl: './transfer-modal.component.html',
  styleUrl: './transfer-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferModalComponent {
  private readonly transferStore = inject(TransferStore);
  private readonly deviceStore = inject(DeviceStore);
  private readonly transferContext: ITransferContext = inject(TRANSFER_CONTEXT);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<TransferModalComponent>);
  private readonly destroyRef = inject(DestroyRef);

  /** Resolved once — the modal is scoped to a single device for its whole lifetime. */
  private readonly deviceId = this.transferStore.getTargetDeviceId()() ?? '';

  private readonly modalState = this.transferStore.getTransferModalState(this.deviceId);
  private readonly deviceTransfer = this.transferStore.getDeviceTransfer(this.deviceId);
  private readonly metrics = this.transferStore.getTransferMetrics(this.deviceId);
  private readonly summary = this.transferStore.getTransferSummary(this.deviceId);

  // `getTransferSummary`'s elapsedLabel only re-evaluates when `transfers` changes, so it would
  // sit frozen between sparse snapshots. This ticker drives the readout independently, one second
  // at a time, and stops once the job reaches a terminal state so it freezes at its final value.
  private readonly tick = signal(Date.now());
  private tickerId: ReturnType<typeof setInterval> | null = null;

  private readonly elapsedLabel = computed(() => {
    const startedAt = this.deviceTransfer()?.startedAt ?? null;
    return startedAt == null ? null : formatElapsedLabel(startedAt, this.tick());
  });

  readonly vm = computed<TransferProgressVm>(() => {
    const transfer = this.deviceTransfer();
    const job = transfer?.job ?? null;
    const metrics = this.metrics();
    const summary = this.summary();
    const device = this.deviceStore.devices().find((d) => d.deviceId === this.deviceId);

    return {
      // Non-null by construction: the shell only opens this dialog while a modal state exists.
      state: this.modalState() as TransferModalState,
      deviceName: device?.name || this.deviceId,
      destinationLabel: job
        ? `${job.storageType} · ${job.destinationDirectory}`
        : transfer?.destinationLabel ?? '',
      droppedRootName: transfer?.droppedRootName ?? null,
      scanFound: transfer?.scanFound ?? 0,
      scanTotal: transfer?.scanTotal ?? 0,
      uploaded: metrics.uploaded,
      written: metrics.written,
      staged: metrics.staged,
      failed: metrics.failed,
      apiPercent: metrics.apiPct,
      devicePercent: metrics.devicePct,
      currentFile: job?.currentFile ?? null,
      feed: transfer?.feed ?? [],
      failures: transfer?.failures ?? [],
      failureOverflow: summary.failureOverflow,
      elapsedLabel: this.elapsedLabel(),
      reason: summary.reason,
    };
  });

  constructor() {
    effect(() => {
      const state = this.modalState();
      if (state != null && TERMINAL_MODAL_STATES.has(state)) {
        this.stopTicker();
      } else {
        this.startTicker();
      }
    });
    this.destroyRef.onDestroy(() => this.stopTicker());

    // Whatever restoreFocus captured at open time (nothing, for a drop gesture), this always wins.
    this.dialogRef.afterClosed().subscribe(() => {
      document.querySelector<HTMLElement>(DROPZONE_PICKER_BUTTON_SELECTOR)?.focus();
    });
  }

  private startTicker(): void {
    if (this.tickerId != null) {
      return;
    }
    this.tickerId = setInterval(() => this.tick.set(Date.now()), 1000);
  }

  private stopTicker(): void {
    if (this.tickerId != null) {
      clearInterval(this.tickerId);
      this.tickerId = null;
    }
  }

  onCancelRequested(): void {
    const hasJob = this.deviceTransfer()?.job != null;

    if (!hasJob) {
      void this.transferContext.cancelTransfer(this.deviceId);
      return;
    }

    const written = this.metrics().written;
    const confirmRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: true,
      panelClass: 'glassy-dialog',
      backdropClass: 'busy-dialog-backdrop',
    });

    confirmRef.componentRef?.setInput('title', 'Cancel transfer?');
    confirmRef.componentRef?.setInput(
      'message',
      `${written} file${written === 1 ? '' : 's'} already written to the device will remain there.`
    );
    confirmRef.componentRef?.setInput('confirmLabel', 'Cancel transfer');
    confirmRef.componentRef?.setInput('cancelLabel', 'Keep transferring');

    confirmRef.componentInstance.confirmed.subscribe(() => {
      confirmRef.close();
      void this.transferContext.cancelTransfer(this.deviceId);
    });
    confirmRef.componentInstance.cancelled.subscribe(() => {
      confirmRef.close();
    });
  }

  onRetryRequested(): void {
    void this.transferContext.retryCreate(this.deviceId);
  }

  async onCloseRequested(): Promise<void> {
    await this.transferContext.closeTransfer(this.deviceId);
    this.dialogRef.close();
  }
}
