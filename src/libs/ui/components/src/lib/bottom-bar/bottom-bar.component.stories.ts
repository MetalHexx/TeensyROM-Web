import type { Meta, StoryObj } from '@storybook/angular';
import { BottomBarComponent } from './bottom-bar.component';
import { BottomBarItem } from './bottom-bar.model';

const items: BottomBarItem[] = [
  { name: 'Home', icon: 'home', route: '/home' },
  { name: 'Browse', icon: 'search', route: '/browse' },
  { name: 'Favorites', icon: 'star', route: '/favorites' },
  { name: 'Settings', icon: 'settings', route: '/settings' },
];

const meta: Meta<BottomBarComponent> = {
  title: 'Layout/Bottom Bar',
  component: BottomBarComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<BottomBarComponent>;

export const Default: Story = {
  args: {
    items,
    activeRoute: '/home',
  },
};
