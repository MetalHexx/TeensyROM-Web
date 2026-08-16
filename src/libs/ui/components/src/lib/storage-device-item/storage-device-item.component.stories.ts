import type { Meta, StoryObj } from '@storybook/angular';
import { StorageDeviceItem, StorageType } from '@teensyrom-nx/domain';
import { StorageDeviceItemComponent } from './storage-device-item.component';

const sdStorageDevice: StorageDeviceItem = {
  name: 'SD Storage',
  storageType: StorageType.Sd,
  icon: 'sd_storage',
  deviceId: 'teensyrom-1',
  itemType: 'storage-device',
};

const usbStorageDevice: StorageDeviceItem = {
  name: 'USB Storage',
  storageType: StorageType.Usb,
  icon: 'usb',
  deviceId: 'teensyrom-1',
  itemType: 'storage-device',
};

const meta: Meta<StorageDeviceItemComponent> = {
  title: 'Navigation & Data/Storage Device Item',
  component: StorageDeviceItemComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<StorageDeviceItemComponent>;

export const SdStorage: Story = {
  args: {
    storageDevice: sdStorageDevice,
    selected: false,
  },
};

export const UsbStorage: Story = {
  args: {
    storageDevice: usbStorageDevice,
    selected: false,
  },
};
