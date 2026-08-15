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
