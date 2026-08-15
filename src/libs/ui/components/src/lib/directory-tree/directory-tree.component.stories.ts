import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryTreeComponent } from './directory-tree.component';
import { mockDirectoryTree, mockGamesNode } from './directory-tree.stories-fixtures';

const meta: Meta<DirectoryTreeComponent> = {
  title: 'Navigation & Data/Directory Tree',
  component: DirectoryTreeComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<DirectoryTreeComponent>;

/**
 * A fake TeensyROM device with SD storage, expanded to show a nested "Games" directory
 * (with an "Arcade" subfolder and a still-loading placeholder) alongside a "Music" leaf.
 * The device and its lone storage node auto-expand; the "Games" directory is pre-selected.
 */
export const Default: Story = {
  args: {
    nodes: mockDirectoryTree,
    selectedNodeId: mockGamesNode.id,
  },
};
