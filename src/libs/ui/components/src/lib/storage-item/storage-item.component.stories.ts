import type { Meta, StoryObj } from '@storybook/angular';
import { StorageItemComponent } from './storage-item.component';

const meta: Meta<StorageItemComponent> = {
  title: 'Navigation & Data/Storage Item',
  component: StorageItemComponent,
  tags: ['autodocs'],
  argTypes: {
    iconColor: {
      control: 'select',
      options: ['normal', 'primary', 'highlight', 'success', 'error', 'dimmed', 'directory'],
    },
  },
};

export default meta;
type Story = StoryObj<StorageItemComponent>;

export const Default: Story = {
  args: {
    icon: 'insert_drive_file',
    iconColor: 'normal',
    label: 'game.crt',
    selected: false,
    active: false,
    disabled: false,
  },
};

export const DirectoryColor: Story = {
  args: {
    ...Default.args,
    icon: 'folder',
    iconColor: 'directory',
    label: 'Games',
  },
};

export const PrimaryColor: Story = {
  args: {
    ...Default.args,
    icon: 'star',
    iconColor: 'primary',
    label: 'Favorite.sid',
  },
};
