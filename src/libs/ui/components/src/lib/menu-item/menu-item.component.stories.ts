import type { Meta, StoryObj } from '@storybook/angular';
import { MenuItemComponent } from './menu-item.component';

const meta: Meta<MenuItemComponent> = {
  title: 'Overlay & Interaction/Menu Item',
  component: MenuItemComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`lib-menu-item` is a standalone, config-driven row for navigation and action ' +
          'lists: pass a `MenuItem` (`name`, `icon`, optional `payload`) and it emits ' +
          '`menuClick` with that same object on activation. It is unrelated to ' +
          '`DropdownMenuComponent` — do not confuse it with `DropdownMenuItemComponent` ' +
          '(`lib-dropdown-menu-item`), which only makes sense projected inside a ' +
          '`lib-dropdown-menu`\'s `[dropdown-content]` slot, takes its label via content ' +
          'projection instead of a config object, and shows a selection-check icon. Reach ' +
          'for `lib-menu-item` for plain rendered lists (settings navigation, device ' +
          'pickers) where each row is fully described by data rather than markup.',
      },
    },
  },
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
