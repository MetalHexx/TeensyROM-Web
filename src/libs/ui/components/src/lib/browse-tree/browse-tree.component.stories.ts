import type { Meta, StoryObj } from '@storybook/angular';
import { StorageType } from '@teensyrom-nx/domain';
import { BrowseTreeComponent, BrowseTreeModel } from './browse-tree.component';

const meta: Meta<BrowseTreeComponent> = {
  title: 'Navigation & Data/Browse Tree',
  component: BrowseTreeComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The DJ view storage browser tree: a single device node with its storage types as ' +
          'leaves. Deliberately stops at storage level rather than navigating into directory ' +
          'contents — the player view handles directory navigation. Uses the player\'s node ' +
          'iconography and colors without the `mat-tree` component.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<BrowseTreeComponent>;

const defaultModel: BrowseTreeModel = {
  deviceId: 'SGVISJTN',
  label: 'Teensy ROM Device',
  icon: 'desktop_windows',
  accessibleName: 'Device SGVISJTN',
  storages: [
    {
      storageType: StorageType.Sd,
      label: 'SD Storage',
      icon: 'sd_storage',
      accessibleName: 'SD Storage, Device SGVISJTN',
    },
    {
      storageType: StorageType.Usb,
      label: 'USB Storage',
      icon: 'usb',
      accessibleName: 'USB Storage, Device SGVISJTN',
    },
  ],
};

export const Default: Story = {
  args: {
    model: defaultModel,
    expanded: true,
    selectedStorageType: StorageType.Sd,
  },
};

export const Collapsed: Story = {
  args: {
    model: defaultModel,
    expanded: false,
    selectedStorageType: null,
  },
};

export const SingleStorage: Story = {
  args: {
    model: {
      ...defaultModel,
      storages: [
        {
          storageType: StorageType.Sd,
          label: 'SD Storage',
          icon: 'sd_storage',
          accessibleName: 'SD Storage, Device SGVISJTN',
        },
      ],
    },
    expanded: true,
    selectedStorageType: null,
  },
};
