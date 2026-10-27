import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import {
  DeviceStore,
  ITransferContext,
  TRANSFER_CONTEXT,
  TransferStore,
  formatElapsedLabel,
} from '@teensyrom-nx/application';
import { TransferOriginKind } from '@teensyrom-nx/domain';
import {
  ScalingCompactCardComponent,
  SlidingContainerComponent,
} from '@teensyrom-nx/ui/components';
import { watchFolderLabel } from '../../transfer-origin-label';
import { TransferRowComponent } from './transfer-row/transfer-row.component';

const UPLOAD_ORIGIN_LABEL = 'Upload';

/**
 * Lists every transfer under way, whoever started it, so a watched folder's work is visible
 * without ever interrupting the user. A row's button opens the details dialog on that device.
 */
@Component({
  selector: 'lib-transfers-card',
  imports: [SlidingContainerComponent, ScalingCompactCardComponent, TransferRowComponent],
  templateUrl: './transfers-card.component.html',
  styleUrl: './transfers-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransfersCardComponent {
  private readonly transferStore = inject(TransferStore);
  private readonly deviceStore = inject(DeviceStore);
  private readonly transferContext: ITransferContext = inject(TRANSFER_CONTEXT);
  private readonly destroyRef = inject(DestroyRef);

  readonly transfers = this.transferStore.getLiveTransfers();

  private readonly tick = signal(Date.now());
  private tickerId: ReturnType<typeof setInterval> | null = null;

  readonly rows = computed(() => {
    const devices = this.deviceStore.devices();
    const tick = this.tick();
    return this.transfers().map((transfer) => {
      const folder = watchFolderLabel(transfer.origin);
      return {
        transfer,
        deviceName: devices.find((d) => d.deviceId === transfer.deviceId)?.name || transfer.deviceId,
        watched: transfer.origin.kind === TransferOriginKind.WatchFolder,
        originLabel: folder ?? UPLOAD_ORIGIN_LABEL,
        elapsedLabel: formatElapsedLabel(transfer.startedAt, tick),
      };
    });
  });

  readonly announcement = computed(() =>
    this.rows()
      .map((row) => `${row.deviceName} ${row.transfer.devicePercent}% written`)
      .join('. ')
  );

  constructor() {
    effect(() => {
      if (this.transfers().length > 0) {
        this.startTicker();
      } else {
        this.stopTicker();
      }
    });
    this.destroyRef.onDestroy(() => this.stopTicker());
  }

  onShowRequested(deviceId: string): void {
    void this.transferContext.showDetails(deviceId);
  }

  private startTicker(): void {
    if (this.tickerId != null) {
      return;
    }
    this.tick.set(Date.now());
    this.tickerId = setInterval(() => this.tick.set(Date.now()), 1000);
  }

  private stopTicker(): void {
    if (this.tickerId != null) {
      clearInterval(this.tickerId);
      this.tickerId = null;
    }
  }
}
