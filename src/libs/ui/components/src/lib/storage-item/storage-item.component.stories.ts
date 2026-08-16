import type { Meta, StoryObj } from '@storybook/angular';
import { StorageItemComponent } from './storage-item.component';

const meta: Meta<StorageItemComponent> = {
  title: 'Navigation & Data/Storage Item',
  component: StorageItemComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A reusable list-item row for storage entries — files, folders, devices — with ' +
          'icon, label, selection state, and full keyboard/touch accessibility. Owns row ' +
          'selection (click, tap, and keyboard handling live on this component) while ' +
          '`StorageItemActionsComponent`, projected as content, owns the trailing metadata ' +
          'label and per-row action buttons; the two are meant to be used together. Uses ' +
          'the `selectable-item` mixin from the `style-guide` skill for its hover/selected/' +
          'active/disabled visual states. Prefer `DirectoryItemComponent` or ' +
          '`StorageDeviceItemComponent` when the row is a folder or a top-level device, ' +
          'since those wrap this component with the right icon/color already fixed.',
      },
    },
  },
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
