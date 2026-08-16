import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryTreeComponent } from './directory-tree.component';
import { mockDirectoryTree, mockGamesNode } from './directory-tree.stories-fixtures';

const meta: Meta<DirectoryTreeComponent> = {
  title: 'Navigation & Data/Directory Tree',
  component: DirectoryTreeComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A sidebar-style hierarchical view of a device, its storage types, and their ' +
          'directories, composing `DirectoryTreeNodeComponent` for each row on top of ' +
          'Angular Material’s `mat-tree`. Supports lazy loading: expanding a node whose ' +
          'only child is a placeholder emits `nodeExpansionNeedsData` so the caller can ' +
          'fetch real children. Choose `lib-directory-tree` when the whole hierarchy needs ' +
          'to be visible and navigable at once; choose `DirectoryTrailComponent` for a ' +
          'single-path breadcrumb header instead.',
      },
    },
  },
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
