import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DirectoryTreeNodeType } from '@teensyrom-nx/domain';
import { IconLabelComponent } from '../../icon-label/icon-label.component';
import type { StyledIconColor } from '../../styled-icon/styled-icon.component';

@Component({
  selector: 'lib-directory-tree-node',
  imports: [CommonModule, IconLabelComponent],
  templateUrl: './directory-tree-node.component.html',
  styleUrl: './directory-tree-node.component.scss',
})
export class DirectoryTreeNodeComponent {
  icon = input.required<string>();
  text = input.required<string>();
  cssClass = input<string>('');
  isSelected = input<boolean>(false);
  nodeType = input<DirectoryTreeNodeType>();

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
