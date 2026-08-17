import type { Meta, StoryObj } from '@storybook/angular';
import { ScalingCompactCardComponent } from './scaling-compact-card.component';

const meta: Meta<ScalingCompactCardComponent> = {
  title: 'Layout/Scaling Compact Card',
  component: ScalingCompactCardComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Animated compact card — the public-facing wrapper for forms and toolbars that ' +
          'should scale, fade, and slide in (and optionally out). Composes ' +
          '`CompactCardLayoutComponent` (body slot only, no header) with ' +
          '`ScalingContainerComponent` in a single component, and inherits glassy backdrop ' +
          'styling from `CompactCardLayoutComponent`. Choose this over ' +
          '`CompactCardLayoutComponent` whenever the surface should animate; use ' +
          '`CompactCardLayoutComponent` directly for one that renders with no transition. ' +
          'For cards that need a header, use `ScalingCardComponent` or its static ' +
          'counterpart, `CardLayoutComponent`.',
      },
    },
  },
  argTypes: {
    animationEntry: {
      control: 'select',
      options: [
        'none',
        'random',
        'from-left',
        'from-right',
        'from-top',
        'from-bottom',
        'from-top-left',
        'from-top-right',
        'from-bottom-left',
        'from-bottom-right',
      ],
    },
    animationExit: {
      control: 'select',
      options: [
        'none',
        'random',
        'from-left',
        'from-right',
        'from-top',
        'from-bottom',
        'from-top-left',
        'from-top-right',
        'from-bottom-left',
        'from-bottom-right',
      ],
    },
    animationTrigger: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<ScalingCompactCardComponent>;

export const Default: Story = {
  args: {
    enableOverflow: true,
    cardClass: '',
    animationEntry: 'from-top',
    animationExit: 'from-top',
    animationTrigger: true,
    animationDuration: 2000,
    animationParent: undefined,
  },
  render: (args) => ({
    props: args,
    template: `<lib-scaling-compact-card [enableOverflow]="enableOverflow" [cardClass]="cardClass" [animationEntry]="animationEntry" [animationExit]="animationExit" [animationTrigger]="animationTrigger" [animationDuration]="animationDuration"><p>Compact card content projected into the default slot.</p></lib-scaling-compact-card>`,
  }),
};
