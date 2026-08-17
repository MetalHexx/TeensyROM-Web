import type { Meta, StoryObj } from '@storybook/angular';
import { CompactCardLayoutComponent } from './compact-card-layout.component';

const meta: Meta<CompactCardLayoutComponent> = {
  title: 'Layout/Compact Card Layout',
  component: CompactCardLayoutComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Minimal card layout — body slot and glassy backdrop styling only, no header, ' +
          'no animation. Built for forms and toolbars where `CardLayoutComponent`\'s header ' +
          'chrome would be unwanted overhead. Choose this when the compact surface should ' +
          'render without an entry/exit transition; choose `ScalingCompactCardComponent` when ' +
          'it should animate in and out (it composes this component with ' +
          '`ScalingContainerComponent`). For cards that need a header, use ' +
          '`CardLayoutComponent` or its animated counterpart, `ScalingCardComponent`. Glassy ' +
          'styling tokens are documented in the `style-guide` skill.',
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
type Story = StoryObj<CompactCardLayoutComponent>;

export const Default: Story = {
  args: {
    enableOverflow: true,
    cardClass: '',
    glassy: true,
    glassyIntensity: 'dark',
  },
  render: (args) => ({
    props: args,
    template: `<lib-compact-card-layout [enableOverflow]="enableOverflow" [cardClass]="cardClass" [glassy]="glassy" [glassyIntensity]="glassyIntensity"><p>Compact card content projected into the default slot.</p></lib-compact-card-layout>`,
  }),
};
