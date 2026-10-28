import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  ConfirmationDialogComponent,
  DropdownDialogComponent,
  IconButtonComponent,
  TooltipConfig,
  TooltipDirective,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import { WatchFolder, WatchFolderState } from '@teensyrom-nx/domain';

/**
 * One watched folder: its path clipped from the left so the folder name stays visible, the
 * on/off switch and the delete button, which asks before it emits. A folder that cannot be
 * watched says so underneath.
 */
@Component({
  selector: 'lib-watch-folder-row',
  imports: [
    MatSlideToggleModule,
    IconButtonComponent,
    TooltipDirective,
    DropdownDialogComponent,
    ConfirmationDialogComponent,
  ],
  templateUrl: './watch-folder-row.component.html',
  styleUrl: './watch-folder-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchFolderRowComponent {
  readonly folder = input.required<WatchFolder>();
  /** Whether a change to this folder is in flight; holds the controls still. */
  readonly pending = input(false);

  /** Emits the new on/off state when the switch is toggled. */
  readonly enabledChange = output<boolean>();
  /** Emits once the user has confirmed stopping the watch. */
  readonly deleteConfirmed = output<void>();

  protected readonly WatchFolderState = WatchFolderState;

  protected readonly enableTooltip: TooltipConfig = {
    body: 'Turn watching this folder on or off.',
    position: TooltipPosition.Left,
  };
  protected readonly deleteTooltip: TooltipConfig = {
    body: 'Stop watching this folder.',
    position: TooltipPosition.Left,
  };

  /**
   * The slide toggle flips itself before it emits, but the engine decides the folder's state: put
   * the switch back to the folder's real state and let the folder input move it once the engine
   * accepts, so a refused change leaves it where it was.
   */
  protected onToggle(toggle: MatSlideToggle, checked: boolean): void {
    toggle.checked = this.folder().enabled;
    this.enabledChange.emit(checked);
  }
}
