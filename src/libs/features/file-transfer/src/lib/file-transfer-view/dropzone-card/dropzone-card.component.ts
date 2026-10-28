import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DeviceStore,
  StorageStore,
  TransferStore,
  TRANSFER_CONTEXT,
  ITransferContext,
} from '@teensyrom-nx/application';
import {
  SlidingContainerComponent,
  ScalingCompactCardComponent,
  ActionButtonComponent,
  EmptyStateMessageComponent,
} from '@teensyrom-nx/ui/components';

type DropzoneCardState = 'idle' | 'drag-over' | 'device-busy' | 'no-destination';

const BUSY_SECONDARY_MESSAGE = 'Wait for it to finish, or pick another device';

/**
 * The view's only drop target. Renders the transfer destination at rest, a distinct treatment
 * while a drag is over the card, and a refusal — before any drag — when the target device
 * already has a transfer running, as recorded in `TransferStore`, or when no storage and folder
 * is selected for the target device to receive files. A refused card is inert: the pickers are
 * disabled and neither a drop nor a pick starts a transfer. Both the drag-and-drop path and the
 * picker fallback hand off to the same `ITransferContext.startTransfer` call.
 */
@Component({
  selector: 'lib-dropzone-card',
  imports: [
    SlidingContainerComponent,
    ScalingCompactCardComponent,
    ActionButtonComponent,
    EmptyStateMessageComponent,
  ],
  templateUrl: './dropzone-card.component.html',
  styleUrl: './dropzone-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropzoneCardComponent {
  private readonly deviceStore = inject(DeviceStore);
  private readonly storageStore = inject(StorageStore);
  private readonly transferStore = inject(TransferStore);
  private readonly transferContext: ITransferContext = inject(TRANSFER_CONTEXT);

  private dragEnterCount = 0;

  readonly targetDeviceId = this.transferStore.getTargetDeviceId();

  readonly targetDevice = computed(
    () => this.deviceStore.devices().find((d) => d.deviceId === this.targetDeviceId()) ?? null
  );

  readonly isBusy = computed(() => {
    const deviceId = this.targetDeviceId();
    return deviceId !== null && this.transferStore.isDeviceBusy(deviceId)();
  });

  /** The target device's selected storage and folder, the same cursor a transfer is captured from. */
  private readonly destination = computed(() => {
    const deviceId = this.targetDeviceId();
    if (!deviceId) return null;

    const selected = this.storageStore.getSelectedDirectoryForDevice(deviceId);
    return selected && selected.storageType !== null ? selected : null;
  });

  readonly hasDestination = computed(() => this.destination() !== null);

  private readonly isDragOver = signal(false);

  readonly cardState = computed<DropzoneCardState>(() => {
    if (this.isBusy()) return 'device-busy';
    if (!this.hasDestination()) return 'no-destination';
    if (this.isDragOver()) return 'drag-over';
    return 'idle';
  });

  /** Whether the pickers and the drop target are refused. */
  readonly isInert = computed(() => this.cardState() === 'device-busy' || !this.hasDestination());

  readonly destinationLabel = computed(() => {
    const selected = this.destination();
    return selected ? `${selected.storageType} · ${selected.path}` : '';
  });

  readonly icon = computed(() => (this.cardState() === 'device-busy' ? 'block' : 'upload_file'));

  readonly title = computed(() => {
    switch (this.cardState()) {
      case 'device-busy':
        return "Can't transfer right now";
      case 'no-destination':
        return 'No destination selected';
      case 'drag-over':
        return 'Drop to transfer';
      default:
        return 'Drop files and/or folders here';
    }
  });

  readonly message = computed(() => {
    if (this.cardState() === 'no-destination') return '';
    if (this.cardState() === 'device-busy') {
      const deviceName = this.targetDevice()?.name ?? 'This device';
      return `${deviceName} already has a transfer in progress`;
    }
    const destination = this.destinationLabel();
    const deviceName = this.targetDevice()?.name;
    if (!deviceName) return destination;
    return destination ? `${deviceName} · ${destination}` : deviceName;
  });

  readonly secondaryMessage = computed(() =>
    this.cardState() === 'device-busy' ? BUSY_SECONDARY_MESSAGE : ''
  );

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragEnterCount++;
    if (!this.isInert()) {
      this.isDragOver.set(true);
    }
  }

  onDragOver(event: DragEvent): void {
    // Required so the browser allows a drop instead of navigating to the dragged payload.
    event.preventDefault();
    if (this.isInert() && event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none';
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
    if (this.dragEnterCount === 0) {
      this.isDragOver.set(false);
    }
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragEnterCount = 0;
    this.isDragOver.set(false);

    if (this.isInert()) return;

    const deviceId = this.targetDeviceId();
    const items = event.dataTransfer?.items;
    if (!deviceId || !items || items.length === 0) return;

    await this.transferContext.startTransfer(deviceId, items);
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.startFromPicker(input.files);
    input.value = '';
  }

  async onFolderSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.startFromPicker(input.files);
    input.value = '';
  }

  private async startFromPicker(files: FileList | null): Promise<void> {
    if (this.isInert() || !files || files.length === 0) return;

    const deviceId = this.targetDeviceId();
    if (!deviceId) return;

    await this.transferContext.startTransfer(deviceId, files);
  }
}
