import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconLabelComponent } from '../icon-label/icon-label.component';

/**
 * A compact glassy pill presenter for drag-preview imagery. Displays an icon and label in a
 * horizontally-stacked, visually lightweight container styled with a dark glassy effect. Used
 * as the visual payload of a native drag operation — the image the user sees following the
 * cursor while dragging.
 *
 * The chip is static for the duration of the drag operation; interactions and data transport
 * are managed by the parent drop zone or container.
 *
 * @example
 * ```html
 * <lib-drag-chip icon="music_note" label="song.sid"></lib-drag-chip>
 * ```
 */
@Component({
  selector: 'lib-drag-chip',
  standalone: true,
  imports: [IconLabelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drag-chip.component.html',
  styleUrl: './drag-chip.component.scss',
})
export class DragChipComponent {
  /**
   * Material Design icon name — defaults to `'music_note'`.
   *
   * @example
   * ```html
   * <lib-drag-chip icon="folder" label="My Folder"></lib-drag-chip>
   * ```
   */
  readonly icon = input<string>('music_note');

  /**
   * Label text to display alongside the icon — required.
   *
   * @example
   * ```html
   * <lib-drag-chip label="song.sid"></lib-drag-chip>
   * ```
   */
  readonly label = input.required<string>();
}
