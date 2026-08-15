import type { Meta, StoryObj } from '@storybook/angular';
import { MenuItemComponent } from './menu-item.component';

const meta: Meta<MenuItemComponent> = {
  title: 'Overlay & Interaction/Menu Item',
  component: MenuItemComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<MenuItemComponent>;

export const Default: Story = {
  args: {
    item: { name: 'Settings', icon: 'settings' },
  },
};

export const WithPayload: Story = {
  args: {
    item: { name: 'SD2 Card', icon: 'sd_card', payload: { deviceId: 'sd2' } },
  },
};
