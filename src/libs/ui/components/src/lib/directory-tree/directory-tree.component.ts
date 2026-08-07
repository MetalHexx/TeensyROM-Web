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
  nodes = input.required<DirectoryTreeNode[]>();
  selectedNodeId = input<string | null>(null);

  nodeActivated = output<DirectoryTreeNode>();
  nodeExpansionNeedsData = output<DirectoryTreeNode>();

  private readonly tree = viewChild<MatTree<DirectoryTreeNode>>('tree');

  childrenAccessor = (node: DirectoryTreeNode) => node.children ?? [];
  hasChild = (_: number, node: DirectoryTreeNode) => !!node.children && node.children.length > 0;
  isPlaceholder = (_: number, node: DirectoryTreeNode) =>
    node.type === DirectoryTreeNodeType.Placeholder;
  trackByFn = (_: number, node: DirectoryTreeNode) => node.id;
  expansionKeyFn = (node: DirectoryTreeNode) => node.id;

  shouldShowExpansionButton(node: DirectoryTreeNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  ngAfterViewInit() {
    this.autoExpandDirectoryNode();
  }

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

  isNodeSelected(node: DirectoryTreeNode): boolean {
    return node.id === this.selectedNodeId();
  }

  onDirectoryClick(node: DirectoryTreeNode) {
    this.nodeActivated.emit(node);
  }

  onNodeKeyDown(event: KeyboardEvent, node: DirectoryTreeNode) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.onDirectoryClick(node);
    }
  }

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
