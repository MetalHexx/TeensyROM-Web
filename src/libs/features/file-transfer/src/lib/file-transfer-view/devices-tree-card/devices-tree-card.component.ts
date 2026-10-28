import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TransferStore } from '@teensyrom-nx/application';
import { Device } from '@teensyrom-nx/domain';
import { ScalingCompactCardComponent } from '@teensyrom-nx/ui/components';
import { DirectoryTreeContainerComponent } from '../directory-tree-container/directory-tree-container.component';

/**
 * Untitled compact card stacking one directory tree per device. Activating any node in a tree makes that
 * device the transfer target; only the target's tree shows a selected node.
 */
@Component({
  selector: 'lib-devices-tree-card',
  imports: [ScalingCompactCardComponent, DirectoryTreeContainerComponent],
  templateUrl: './devices-tree-card.component.html',
  styleUrl: './devices-tree-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesTreeCardComponent {
  private readonly transferStore = inject(TransferStore);

  /** The devices to draw a tree for. */
  readonly devices = input.required<readonly Device[]>();

  readonly targetDeviceId = this.transferStore.getTargetDeviceId();

  onNodeActivated(deviceId: string): void {
    this.transferStore.setTargetDevice({ deviceId });
  }
}
