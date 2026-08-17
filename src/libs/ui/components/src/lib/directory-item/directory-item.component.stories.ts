import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryItemComponent } from './directory-item.component';
import {
  mockArcadeDirectoryItem,
  mockGamesDirectoryItem,
} from '../directory-tree/directory-tree.stories-fixtures';

const meta: Meta<DirectoryItemComponent> = {
  title: 'Navigation & Data/Directory Item',
  component: DirectoryItemComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders a single folder row inside a directory listing, fixing the icon and ' +
          'color that `StorageItemComponent` otherwise leaves open. Choose it over the bare ' +
          '`StorageItemComponent` whenever the row is a folder, so every listing shows the ' +
          'same folder icon and directory color; reach for `StorageDeviceItemComponent` ' +
          'instead when the row represents a top-level storage device rather than a folder ' +
          'within one.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<DirectoryItemComponent>;

export const Default: Story = {
  args: {
    directoryItem: mockGamesDirectoryItem,
    selected: false,
  },
};

export const Selected: Story = {
  args: {
    directoryItem: mockArcadeDirectoryItem,
    selected: true,
  },
};
