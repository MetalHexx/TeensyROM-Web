import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryTreeNodeComponent } from './directory-tree-node.component';
import { mockGamesNode } from '../directory-tree.stories-fixtures';

const meta: Meta<DirectoryTreeNodeComponent> = {
  title: 'Navigation & Data/Directory Tree Node',
  component: DirectoryTreeNodeComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The icon-plus-label content of one `DirectoryTreeComponent` row, with icon ' +
          'color derived from `nodeType`. Normally rendered by `DirectoryTreeComponent` ' +
          'inside each tree row template; render it directly only when another surface ' +
          'needs the same node iconography and selection styling outside of the tree ' +
          'itself.',
      },
    },
  },
  argTypes: {
    nodeType: {
      control: 'select',
      options: ['device', 'storage', 'directory', 'placeholder'],
      description:
        'Node kind, driving icon color: device → primary, storage → highlight, ' +
        'directory → directory color, placeholder → highlight (falls through the default case).',
    },
  },
};

export default meta;
type Story = StoryObj<DirectoryTreeNodeComponent>;

/** The "Games" directory node from the shared mock tree, which itself has 2 children. */
export const Default: Story = {
  args: {
    icon: mockGamesNode.icon,
    text: mockGamesNode.name,
    cssClass: '',
    isSelected: false,
    nodeType: mockGamesNode.type,
  },
};

export const Selected: Story = {
  args: {
    ...Default.args,
    isSelected: true,
  },
};
