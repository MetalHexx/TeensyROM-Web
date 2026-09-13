import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { BrowseTreeComponent, type BrowseTreeModel, type BrowseTreeStorageModel } from '@teensyrom-nx/ui/components';
import { StorageType, type Device } from '@teensyrom-nx/domain';
import type { ActiveStorage } from '../active-storage';

/** A storage leaf activated in one of the rendered trees. */
export interface DjStorageSelectEvent {
  readonly deviceId: string;
  readonly storageType: StorageType;
}

/**
 * The DJ view's browse band: one `lib-browse-tree` per device, each device's available
 * storages as leaves. Pure presentation composition over the view's own `devices` /
 * `activeStorage` inputs — the view is the only place that talks to a store.
 */
@Component({
  selector: 'lib-dj-browse-trees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrowseTreeComponent],
  templateUrl: './dj-browse-trees.component.html',
  styleUrl: './dj-browse-trees.component.scss',
})
export class DjBrowseTreesComponent {
  readonly devices = input.required<readonly Device[]>();
  readonly activeStorage = input<ActiveStorage | null>(null);

  readonly storageSelect = output<DjStorageSelectEvent>();

  /** Each device's tree defaults open; only collapsed entries are recorded here. */
  private readonly expandedByDeviceId = signal<Record<string, boolean>>({});

  readonly trees = computed<readonly BrowseTreeModel[]>(() =>
    this.devices().map(toBrowseTreeModel)
  );

  isExpanded(deviceId: string): boolean {
    return this.expandedByDeviceId()[deviceId] ?? true;
  }

  selectedStorageTypeFor(deviceId: string): StorageType | null {
    const active = this.activeStorage();
    return active && active.deviceId === deviceId ? active.storageType : null;
  }

  onExpandedChange(deviceId: string, expanded: boolean): void {
    this.expandedByDeviceId.update((state) => ({ ...state, [deviceId]: expanded }));
  }

  onStorageSelect(deviceId: string, storageType: StorageType): void {
    this.storageSelect.emit({ deviceId, storageType });
  }
}

function toBrowseTreeModel(device: Device): BrowseTreeModel {
  const storages: BrowseTreeStorageModel[] = [];

  if (device.sdStorage?.available) {
    storages.push({
      storageType: StorageType.Sd,
      label: 'SD Storage',
      icon: 'sd_storage',
      accessibleName: `SD Storage, Device ${device.deviceId}`,
    });
  }
  if (device.usbStorage?.available) {
    storages.push({
      storageType: StorageType.Usb,
      label: 'USB Storage',
      icon: 'usb',
      accessibleName: `USB Storage, Device ${device.deviceId}`,
    });
  }

  return {
    deviceId: device.deviceId,
    label: device.name,
    icon: 'desktop_windows',
    accessibleName: `Device ${device.deviceId}`,
    storages,
  };
}
