import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  viewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTreeModule, MatTree } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { DirectoryTreeNodeComponent } from './directory-tree-node/directory-tree-node.component';
import { DirectoryTreeNode, DirectoryTreeNodeType } from '@teensyrom-nx/domain';
import { ScalingCardComponent } from '../scaling-card/scaling-card.component';

/**
 * A hierarchical device/storage/directory tree, built on Angular Material's `mat-tree` and
 * rendering each row through `DirectoryTreeNodeComponent`. Supports lazy expansion: a node
 * whose only child is a `Placeholder`-typed node emits `nodeExpansionNeedsData` the moment
 * it is expanded, so the caller can fetch real children and replace the placeholder.  The
 * lone device node and its lone storage-type child (when there is exactly one) auto-expand
 * on init.
 *
 * Reach for `lib-directory-tree` for a sidebar-style view of the whole device/storage/
 * directory hierarchy at once. Use `DirectoryTrailComponent` instead for a single-path
 * breadcrumb header, or `DirectoryItemComponent` for a flat listing of one directory's
 * immediate contents.
 *
 * @example
 * ```html
 * <lib-directory-tree
 *   [nodes]="deviceTree()"
 *   [selectedNodeId]="selectedNodeId()"
 *   (nodeActivated)="onNodeActivated($event)"
 *   (nodeExpansionNeedsData)="onNeedsData($event)"
 * ></lib-directory-tree>
 * ```
 */
@Component({
  selector: 'lib-directory-tree',
  imports: [
    CommonModule,
    MatCardModule,
    MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    DirectoryTreeNodeComponent,
    ScalingCardComponent,
  ],
  templateUrl: './directory-tree.component.html',
  styleUrl: './directory-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryTreeComponent implements AfterViewInit {
  /** The forest of nodes to render, typically a single device node. See the exported `DirectoryTreeNode` type (`@teensyrom-nx/domain`) for its shape and `DirectoryTreeNodeType` for the node kinds it distinguishes. */
  nodes = input.required<DirectoryTreeNode[]>();
  /** The `id` of the node to render as selected, or `null` for no selection. Defaults to `null`. */
  selectedNodeId = input<string | null>(null);

  /** Emitted when a node is clicked or activated via Enter/Space — the "navigate here" action for both leaf and expandable nodes. */
  nodeActivated = output<DirectoryTreeNode>();
  /** Emitted when a node with only a placeholder child is expanded, signaling the caller to fetch that node's real children. */
  nodeExpansionNeedsData = output<DirectoryTreeNode>();

  /** Reference to the underlying `mat-tree`, used to programmatically expand nodes and query expansion state. */
  private readonly tree = viewChild<MatTree<DirectoryTreeNode>>('tree');

  /** `mat-tree` children accessor: returns a node's children, or an empty array for leaves. */
  childrenAccessor = (node: DirectoryTreeNode) => node.children ?? [];
  /** `mat-tree` predicate: whether a node has at least one child. */
  hasChild = (_: number, node: DirectoryTreeNode) => !!node.children && node.children.length > 0;
  /** `mat-tree` predicate: whether a node is the lazy-loading placeholder type. */
  isPlaceholder = (_: number, node: DirectoryTreeNode) =>
    node.type === DirectoryTreeNodeType.Placeholder;
  /** `trackBy` function for the tree's node iteration, keyed by node `id`. */
  trackByFn = (_: number, node: DirectoryTreeNode) => node.id;
  /** Expansion-tracking key function for the tree, keyed by node `id`. */
  expansionKeyFn = (node: DirectoryTreeNode) => node.id;

  /** Whether a node should render an expand/collapse toggle button. */
  shouldShowExpansionButton(node: DirectoryTreeNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  /** Auto-expands the lone device node (and its lone storage-type child, if there is exactly one) after the view initializes. */
  ngAfterViewInit() {
    this.autoExpandDirectoryNode();
  }

  /** Expands every device node, and each device's sole storage-type child when it has exactly one. */
  private autoExpandDirectoryNode() {
    const treeComponent = this.tree();
    if (treeComponent) {
      setTimeout(() => {
        const nodes = this.nodes();
        const deviceNodes = nodes.filter((node) => node.type === DirectoryTreeNodeType.Device);

        deviceNodes.forEach((deviceNode) => {
          treeComponent.expand(deviceNode);

          // If there's only one storage node, auto-expand it too
          if (deviceNode.children && deviceNode.children.length === 1) {
            const storageNode = deviceNode.children[0];
            if (storageNode.type === DirectoryTreeNodeType.StorageType) {
              treeComponent.expand(storageNode);
            }
          }
        });
      });
    }
  }

  /** Whether the given node matches `selectedNodeId()`. */
  isNodeSelected(node: DirectoryTreeNode): boolean {
    return node.id === this.selectedNodeId();
  }

  /** Emits `nodeActivated` for the given node. */
  onDirectoryClick(node: DirectoryTreeNode) {
    this.nodeActivated.emit(node);
  }

  /** Activates a node on `Enter`/`Space`, matching the click behavior. */
  onNodeKeyDown(event: KeyboardEvent, node: DirectoryTreeNode) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.onDirectoryClick(node);
    }
  }

  /** After the tree's expansion state updates, emits `nodeExpansionNeedsData` if the toggled node's only child is a placeholder. */
  onToggleClick(node: DirectoryTreeNode) {
    // Use setTimeout to let the Material Tree update its expansion state first
    setTimeout(() => {
      const treeComponent = this.tree();
      if (treeComponent) {
        const isExpanded = treeComponent.isExpanded(node);

        // Only proceed if the node is now expanded
        if (isExpanded) {
          // Check if the expanded node has placeholder children
          const hasPlaceholderChildren =
            node.children &&
            node.children.length === 1 &&
            node.children[0].type === DirectoryTreeNodeType.Placeholder;

          if (hasPlaceholderChildren) {
            this.nodeExpansionNeedsData.emit(node);
          }
        }
      }
    }, 50);
  }
}
