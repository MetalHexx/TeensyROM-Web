import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryTreeNodeComponent } from './directory-tree-node.component';
import { mockGamesNode } from '../directory-tree.stories-fixtures';

const meta: Meta<DirectoryTreeNodeComponent> = {
  title: 'Navigation & Data/Directory Tree Node',
  component: DirectoryTreeNodeComponent,
  tags: ['autodocs'],
  argTypes: {
    nodeType: {
      control: 'select',
      options: ['device', 'storage', 'directory', 'placeholder'],
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
