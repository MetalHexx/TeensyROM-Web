import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { filter } from 'rxjs';
import { ConfirmationDialogComponent } from '@teensyrom-nx/ui/components';
import {
  DeviceStore,
  formatElapsedLabel,
  ITransferContext,
  TRANSFER_CONTEXT,
  TransferModalState,
  TransferStore,
} from '@teensyrom-nx/application';
import { watchFolderLabel } from '../transfer-origin-label';
import {
  STATE_SHAPES,
  TransferProgressComponent,
  TransferProgressVm,
} from './transfer-progress/transfer-progress.component';
import { TransferTabsComponent, transferTabId } from './transfer-tabs/transfer-tabs.component';

/**
 * The dropzone card's file picker button — the focus-return anchor for a drop, which is a
 * pointer gesture with no focused element of its own to return to.
 */
const DROPZONE_PICKER_BUTTON_SELECTOR = '[data-testid="dropzone-choose-files"] button';

/** Once the modal reaches one of these, the elapsed ticker stops advancing. */
const TERMINAL_MODAL_STATES = new Set<TransferModalState>(['completed', 'cancelled', 'aborted', 'abandoned']);

/**
 * Thin host that binds `TransferStore` state to `TransferProgressComponent` and follows the
 * store's `detailsDeviceId`, so the tab row can switch it between transfers. Owns no metric
 * arithmetic — every view-model field is read straight from a selector — and owns exactly the
 * side effects the presentational component can't: cancel's confirm-before-abort gate, retry,
 * hiding, and closing itself out through `ITransferContext`.
 */
@Component({
  selector: 'lib-transfer-modal',
  imports: [TransferProgressComponent, TransferTabsComponent],
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

  /** The device whose transfer is shown; empty once the dialog has been hidden or closed. */
  readonly deviceId = computed(() => this.transferStore.getDetailsDeviceId()() ?? '');

  private readonly modalState = computed(() => this.transferStore.getTransferModalState(this.deviceId())());
  private readonly deviceTransfer = computed(() => this.transferStore.getDeviceTransfer(this.deviceId())());
  private readonly metrics = computed(() => this.transferStore.getTransferMetrics(this.deviceId())());
  private readonly summary = computed(() => this.transferStore.getTransferSummary(this.deviceId())());

  readonly tabs = this.transferStore.getTransferTabs();
  readonly tabDeviceNames = computed(() =>
    Object.fromEntries(this.deviceStore.devices().map((d) => [d.deviceId, d.name]))
  );
  readonly panelLabelledBy = computed(() => transferTabId(this.deviceId()));

  /** Whether the transfer last shown was this tab's own; `afterClosed` fires after the store has reset. */
  private lastShownStartedHere = false;

  // `getTransferSummary`'s elapsedLabel only re-evaluates when `transfers` changes, so it would
  // sit frozen between sparse snapshots. This ticker drives the readout independently, one second
  // at a time, and stops once the job reaches a terminal state so it freezes at its final value.
  private readonly tick = signal(Date.now());
  private tickerId: ReturnType<typeof setInterval> | null = null;

  private readonly elapsedLabel = computed(() => {
    const startedAt = this.deviceTransfer()?.startedAt ?? null;
    return startedAt == null ? null : formatElapsedLabel(startedAt, this.tick());
  });

  /** Held so the frame keeps its last content while the dialog fades out after a hide or close. */
  private lastVm: TransferProgressVm | null = null;

  readonly vm = computed<TransferProgressVm>(() => {
    if (this.modalState() === null && this.lastVm) {
      return this.lastVm;
    }
    const transfer = this.deviceTransfer();
    const job = transfer?.job ?? null;
    const metrics = this.metrics();
    const summary = this.summary();
    const deviceId = this.deviceId();
    const device = this.deviceStore.devices().find((d) => d.deviceId === deviceId);

    this.lastVm = {
      // Non-null by construction: the shell only opens this dialog while a modal state exists.
      state: this.modalState() as TransferModalState,
      deviceName: device?.name || deviceId,
      destinationLabel: job
        ? `${job.storageType} · ${job.destinationDirectory}`
        : transfer?.destinationLabel ?? '',
      droppedRootName: transfer?.droppedRootName ?? null,
      originLabel: job ? watchFolderLabel(job.origin) : null,
      scanFound: transfer?.scanFound ?? 0,
      // A transfer started elsewhere never scanned here, so its manifest size is the job's own total.
      scanTotal: transfer && !transfer.startedHere ? metrics.total : transfer?.scanTotal ?? 0,
      uploaded: metrics.uploaded,
      written: metrics.written,
      failed: metrics.failed,
      apiPercent: metrics.apiPct,
      devicePercent: metrics.devicePct,
      hasArchive: metrics.hasArchive,
      expansionPercent: metrics.expansionPct,
      expandingArchive: metrics.expandingArchive,
      expansionComplete: metrics.expansionComplete,
      expandedTotal: metrics.expandedTotal,
      filesPerSecond: job?.filesPerSecond ?? 0,
      uploadBytesPerSecond: metrics.uploadBytesPerSecond,
      bytesPerSecond: job?.bytesPerSecond ?? 0,
      feed: transfer?.feed ?? [],
      failures: transfer?.failures ?? [],
      failureOverflow: summary.failureOverflow,
      elapsedLabel: this.elapsedLabel(),
      reason: summary.reason,
    };
    return this.lastVm;
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

    effect(() => {
      const transfer = this.deviceTransfer();
      if (transfer) {
        untracked(() => (this.lastShownStartedHere = transfer.startedHere));
      }
    });

    // Whatever restoreFocus captured at open time (nothing, for a drop gesture), this always wins —
    // but only for the user's own drop; a transfer started elsewhere has no drop to return from.
    this.dialogRef.afterClosed().subscribe(() => {
      if (this.lastShownStartedHere) {
        document.querySelector<HTMLElement>(DROPZONE_PICKER_BUTTON_SELECTOR)?.focus();
      }
    });

    // Escape follows the same rule as the buttons: it hides a running transfer, closes an ended
    // or refused one, and does nothing while a scan or create is still in flight.
    this.dialogRef
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.onEscape());
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
    const deviceId = this.deviceId();
    const hasJob = this.deviceTransfer()?.job != null;

    if (!hasJob) {
      void this.transferContext.cancelTransfer(deviceId);
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
    confirmRef.componentRef?.setInput('showLabels', true);
    confirmRef.componentRef?.setInput('confirmIcon', 'close');

    confirmRef.componentInstance.confirmed.subscribe(() => {
      confirmRef.close();
      void this.transferContext.cancelTransfer(deviceId);
    });
    confirmRef.componentInstance.cancelled.subscribe(() => {
      confirmRef.close();
    });
  }

  onRetryRequested(): void {
    void this.transferContext.retryCreate(this.deviceId());
  }

  onHideRequested(): void {
    void this.transferContext.hideDetails();
  }

  onTabSelected(deviceId: string): void {
    void this.transferContext.showDetails(deviceId);
  }

  async onCloseRequested(): Promise<void> {
    await this.transferContext.closeTransfer(this.deviceId());
    this.dialogRef.close();
  }

  private onEscape(): void {
    const state = this.modalState();
    if (state === null) {
      return;
    }
    switch (STATE_SHAPES[state]) {
      case 'active':
        this.onHideRequested();
        return;
      case 'scan':
        return;
      default:
        void this.onCloseRequested();
    }
  }
}
