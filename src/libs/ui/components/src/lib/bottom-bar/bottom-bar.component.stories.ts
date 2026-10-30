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
  parameters: {
    docs: {
      description: {
        component:
          'Mobile-only bottom navigation bar for phone breakpoints — a flat, square, ' +
          'frosted-glass strip fixed to the bottom of the viewport, with no card wrapper ' +
          'or rounded corners. Swap this in place of `NavRailComponent` at the phone ' +
          'breakpoint (below 640px) so the vertical rail remains untouched at tablet and ' +
          'desktop sizes; `BottomBarItem` mirrors `NavRailItem` so the same items array ' +
          'can drive both.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<BottomBarComponent>;

export const Default: Story = {
  args: {
    items,
    activeRoute: '/home',
  },
};

/** Six entries in a 390px phone-width frame: every entry gets an equal share and long labels wrap to two lines. */
export const SixItemsPhone: Story = {
  args: {
    items: [
      { name: 'Player', icon: 'play_circle', route: '/player' },
      { name: 'DJ Mixer', icon: 'album', route: '/dj' },
      { name: 'File Transfer', icon: 'swap_horiz', route: '/files' },
      { name: 'Devices', icon: 'usb', route: '/devices' },
      { name: 'Theme', icon: 'palette', route: '/theme' },
      { name: 'Settings', icon: 'settings', route: '/settings' },
    ],
    activeRoute: '/player',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="position: relative; width: 390px; height: 120px; transform: translateZ(0); border: 1px dashed rgba(255,255,255,0.2);">
        <lib-bottom-bar [items]="items" [activeRoute]="activeRoute" style="position: absolute;" />
      </div>
    `,
  }),
};
