import type { Meta, StoryObj } from '@storybook/angular';
import { NavRailComponent } from './nav-rail.component';
import { NavRailItem } from './nav-rail.model';

const items: NavRailItem[] = [
  { name: 'Home', icon: 'home', route: '/home' },
  { name: 'Browse', icon: 'search', route: '/browse' },
  { name: 'Favorites', icon: 'star', route: '/favorites' },
  { name: 'Settings', icon: 'settings', route: '/settings' },
];

const meta: Meta<NavRailComponent> = {
  title: 'Layout/Nav Rail',
  component: NavRailComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<NavRailComponent>;

export const Default: Story = {
  args: {
    items,
    activeRoute: '/home',
    collapsedWidth: '56px',
    expandedWidth: '200px',
    hoverDelayMs: 150,
  },
};
