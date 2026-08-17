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
  parameters: {
    docs: {
      description: {
        component:
          'Vertical navigation rail for tablet/desktop widths — collapsed to icons-only by ' +
          'default, expanding on hover (or when pinned) to show labels. Renders a list of ' +
          '`NavRailItemComponent` entries wrapped in a `ScalingCompactCardComponent` for ' +
          'consistent styling and entry animation. At the phone breakpoint (below 640px), ' +
          'hover expansion is disabled here — swap in `BottomBarComponent` instead for a ' +
          'fixed bottom strip more appropriate for touch navigation; both share the same ' +
          'item shape (`NavRailItem`/`BottomBarItem`).',
      },
    },
  },
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
