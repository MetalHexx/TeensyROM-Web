import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { SetRowModel } from '../set-row/set-row.component';

/** The three fields of a set row the ghost shows. */
export type SetRowGhostRow = Pick<SetRowModel, 'numberText' | 'title' | 'author'>;

/**
 * The drag image of a set row: a solid, row-shaped box with the row's number, title and, when
 * it has one, author. Meant to be rendered off-screen and handed to `DataTransfer.setDragImage`;
 * its backing is opaque because a drag image is a flat snapshot.
 *
 * @example
 * ```html
 * <lib-set-row-ghost [row]="{ numberText: '03', title: 'Cybernoid II', author: 'Jeroen Tel' }" />
 * ```
 */
@Component({
  selector: 'lib-set-row-ghost',
  templateUrl: './set-row-ghost.component.html',
  styleUrl: './set-row-ghost.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetRowGhostComponent {
  /** The row being dragged. */
  readonly row = input.required<SetRowGhostRow>();
}
