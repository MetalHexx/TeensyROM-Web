import type { Meta, StoryObj } from '@storybook/angular';
import { NavRailItemComponent } from './nav-rail-item.component';
import { NavRailItem } from './nav-rail.model';

const item: NavRailItem = { name: 'Home', icon: 'home', route: '/home' };

const meta: Meta<NavRailItemComponent> = {
  title: 'Layout/Nav Rail Item',
  component: NavRailItemComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single icon+label row used inside `NavRailComponent`\'s item list. Displays ' +
          'the item\'s icon always, and its label only when `isExpanded` is `true`, ' +
          'matching the rail\'s collapsed/expanded state. Emits `itemClick` on pointer click ' +
          'or keyboard activation (Enter/Space) rather than navigating itself, so the parent ' +
          'stays in control of routing. Not meant to be used standalone outside a nav rail ' +
          '— reach for `NavRailComponent` to render a full item list.',
      },
    },
  },
  argTypes: {
    isExpanded: { control: 'boolean' },
    isActive: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<NavRailItemComponent>;

export const Collapsed: Story = {
  args: {
    item,
    isExpanded: false,
    isActive: false,
  },
  render: (args) => ({
    props: args,
    template: `<lib-nav-rail-item [item]="item" [isExpanded]="isExpanded" [isActive]="isActive"></lib-nav-rail-item>`,
  }),
};

export const ExpandedActive: Story = {
  args: {
    item,
    isExpanded: true,
    isActive: true,
  },
  render: (args) => ({
    props: args,
    template: `<lib-nav-rail-item [item]="item" [isExpanded]="isExpanded" [isActive]="isActive"></lib-nav-rail-item>`,
  }),
};
