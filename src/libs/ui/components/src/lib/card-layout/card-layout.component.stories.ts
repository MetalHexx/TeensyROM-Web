import type { Meta, StoryObj } from '@storybook/angular';
import { CardLayoutComponent } from './card-layout.component';

const meta: Meta<CardLayoutComponent> = {
  title: 'Layout/Card Layout',
  component: CardLayoutComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Static card layout with header, corner, and body slots, plus glassy backdrop ' +
          'styling — no animation. Choose `CardLayoutComponent` when a card should render ' +
          'without an entry/exit transition; choose `ScalingCardComponent` when it should ' +
          'animate in and out (it composes this component with `ScalingContainerComponent`). ' +
          'For header-less, compact cards (forms, toolbars) use `CompactCardLayoutComponent` ' +
          'or its animated counterpart, `ScalingCompactCardComponent`. Glassy styling tokens ' +
          'are documented in the `style-guide` skill.',
      },
    },
  },
  argTypes: {
    glassyIntensity: {
      control: 'select',
      options: ['subtle', 'light', 'medium', 'strong', 'dark', 'default'],
    },
  },
};

export default meta;
type Story = StoryObj<CardLayoutComponent>;

export const WithBody: Story = {
  args: {
    title: 'Card Title',
    subtitle: 'Card subtitle',
    metadataSource: undefined,
    enableOverflow: true,
    cardClass: '',
    glassy: true,
    glassyIntensity: 'dark',
  },
  render: (args) => ({
    props: args,
    template: `<lib-card-layout [title]="title" [subtitle]="subtitle" [metadataSource]="metadataSource" [enableOverflow]="enableOverflow" [cardClass]="cardClass" [glassy]="glassy" [glassyIntensity]="glassyIntensity"><p>Sample card content projected into the default slot.</p><p>A second paragraph to show wrapping behavior.</p></lib-card-layout>`,
  }),
};

export const WithHeaderSlot: Story = {
  args: {
    ...WithBody.args,
    title: 'Card With Header',
  },
  render: (args) => ({
    props: args,
    template: `<lib-card-layout [title]="title" [subtitle]="subtitle" [metadataSource]="metadataSource" [enableOverflow]="enableOverflow" [cardClass]="cardClass" [glassy]="glassy" [glassyIntensity]="glassyIntensity"><span slot="header">Custom header content</span><p>Card body content projected into the default slot.</p></lib-card-layout>`,
  }),
};
