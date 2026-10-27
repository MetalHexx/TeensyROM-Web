import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ConfirmationDialogComponent,
  DropdownDialogComponent,
  IconButtonComponent,
} from '@teensyrom-nx/ui/components';
import { WatchFolderDestination } from '@teensyrom-nx/domain';

/**
 * One device a watched folder delivers to: its name, where on the device the files land, a Launch
 * tag when they are launched, and edit and delete buttons. Delete asks before it emits, and warns
 * when removing this device also removes its folder.
 */
@Component({
  selector: 'lib-watch-folder-device-row',
  imports: [IconButtonComponent, DropdownDialogComponent, ConfirmationDialogComponent],
  templateUrl: './watch-folder-device-row.component.html',
  styleUrl: './watch-folder-device-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchFolderDeviceRowComponent {
  readonly destination = input.required<WatchFolderDestination>();
  /** Whether this is the folder's only device, so removing it removes the folder. */
  readonly isLastDevice = input(false);
  /** Whether a change to the folder is in flight; holds the buttons still. */
  readonly pending = input(false);

  /** Emits when the edit button is pressed. */
  readonly edit = output<void>();
  /** Emits once the user has confirmed removing the device. */
  readonly deleteConfirmed = output<void>();

  protected readonly deviceLabel = computed(
    () => this.destination().deviceName ?? this.destination().deviceId
  );

  protected readonly removeMessage = computed(() =>
    this.isLastDevice() ? "This is the folder's last device, so the folder is removed too." : ''
  );
}
