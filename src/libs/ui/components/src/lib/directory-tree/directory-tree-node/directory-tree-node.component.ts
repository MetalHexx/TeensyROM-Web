import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DirectoryTreeNodeType } from '@teensyrom-nx/domain';
import { IconLabelComponent } from '../../icon-label/icon-label.component';
import type { StyledIconColor } from '../../styled-icon/styled-icon.component';

/**
 * The visual content of a single `DirectoryTreeComponent` row: an icon-plus-label pair
 * whose icon color is derived from `nodeType` (device, storage, or directory), plus a
 * selected-state highlight.
 *
 * `lib-directory-tree-node` is normally rendered by `DirectoryTreeComponent` inside each
 * `mat-tree-node` template; render it directly only when another surface needs the exact
 * same node iconography and selection styling outside of the tree itself (e.g. a search
 * result echoing a tree node's appearance).
 *
 * @example
 * ```html
 * <lib-directory-tree-node
 *   [icon]="node.icon"
 *   [text]="node.name"
 *   [isSelected]="isNodeSelected(node)"
 *   [nodeType]="node.type"
 * ></lib-directory-tree-node>
 * ```
 */
@Component({
  selector: 'lib-directory-tree-node',
  imports: [CommonModule, IconLabelComponent],
  templateUrl: './directory-tree-node.component.html',
  styleUrl: './directory-tree-node.component.scss',
})
export class DirectoryTreeNodeComponent {
  /** Material icon name shown before the label. */
  icon = input.required<string>();
  /** The node's display label. */
  text = input.required<string>();
  /** Additional CSS class(es) applied to the host `div`. Defaults to `''`. */
  cssClass = input<string>('');
  /** Whether this node is the tree's currently selected node; applies the `.selected` highlight. Defaults to `false`. */
  isSelected = input<boolean>(false);
  /** The kind of node being rendered — drives the icon color (device: primary, storage: highlight, directory: directory, unset/other: highlight). See the exported `DirectoryTreeNodeType` enum (`@teensyrom-nx/domain`). */
  nodeType = input<DirectoryTreeNodeType>();

  /** Icon color derived from `nodeType()`: `'primary'` for a device, `'directory'` for a directory, `'highlight'` otherwise. */
  readonly iconColor = computed<StyledIconColor>(() => {
    switch (this.nodeType()) {
      case DirectoryTreeNodeType.Device:
        return 'primary';
      case DirectoryTreeNodeType.StorageType:
        return 'highlight';
      case DirectoryTreeNodeType.Directory:
        return 'directory';
      default:
        return 'highlight';
    }
  });
}
