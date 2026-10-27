import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DirectoryTreeNodeType } from '@teensyrom-nx/domain';
import { DirectoryTreeNodeComponent } from '../directory-tree/directory-tree-node/directory-tree-node.component';

/** One saved set in the tree. */
export interface SetsTreeBranchSet {
  readonly id: string;
  readonly name: string;
  /** This is the set the DJ view has loaded: shown selected. */
  readonly loaded: boolean;
  /** e.g. 'Set Friday warm-up, loaded'. */
  readonly accessibleName: string;
}

/** The Sets branch's caller-composed state. */
export interface SetsTreeBranchModel {
  /** The branch row's text, e.g. 'Sets'. */
  readonly label: string;
  readonly sets: readonly SetsTreeBranchSet[];
}

/**
 * The Sets branch of the DJ browse tree: a branch row (icon, chevron, `aria-expanded`) over a
 * group of the saved sets, with the loaded one selected. It has the same treeitem semantics as
 * `lib-browse-tree` — Enter and Space activate a row, as a click does — and draws its rows with
 * `lib-directory-tree-node` so it matches the tree around it. Purely presentational.
 *
 * @example
 * ```html
 * <lib-sets-tree-branch
 *   [model]="branch()"
 *   [expanded]="expanded()"
 *   (expandedChange)="expanded.set($event)"
 *   (setSelect)="onOpenSet($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-sets-tree-branch',
  imports: [MatIconModule, DirectoryTreeNodeComponent],
  templateUrl: './sets-tree-branch.component.html',
  styleUrl: './sets-tree-branch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetsTreeBranchComponent {
  /** The branch's label and sets. */
  readonly model = input.required<SetsTreeBranchModel>();
  /** Whether the set rows are showing. Defaults to `true`. */
  readonly expanded = input<boolean>(true);
  /** Emits the new expanded state when the branch row is activated. */
  readonly expandedChange = output<boolean>();
  /** Emits a set's id when its row is activated. */
  readonly setSelect = output<string>();

  protected readonly DirectoryTreeNodeType = DirectoryTreeNodeType;

  protected onBranchActivate(event?: Event): void {
    event?.preventDefault();
    this.expandedChange.emit(!this.expanded());
  }

  protected onSetActivate(id: string, event?: Event): void {
    event?.preventDefault();
    this.setSelect.emit(id);
  }
}
