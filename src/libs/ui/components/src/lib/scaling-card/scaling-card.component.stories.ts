import type { Meta, StoryObj } from '@storybook/angular';
import { ScalingCardComponent } from './scaling-card.component';

const meta: Meta<ScalingCardComponent> = {
  title: 'Layout/Scaling Card',
  component: ScalingCardComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Animated card — the public-facing wrapper for standard content that should ' +
          'scale, fade, and slide in (and optionally out). Composes `CardLayoutComponent` ' +
          '(header, corner, and body slots) with `ScalingContainerComponent` in a single ' +
          'component, and inherits glassy backdrop styling from `CardLayoutComponent`. ' +
          'Choose this over `CardLayoutComponent` whenever the card should animate; use ' +
          '`CardLayoutComponent` directly for a card that renders with no transition. For ' +
          'compact, header-less surfaces (forms, toolbars) use ' +
          '`ScalingCompactCardComponent` or its static counterpart, ' +
          '`CompactCardLayoutComponent`.',
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
type Story = StoryObj<ScalingCardComponent>;

export const Default: Story = {
  args: {
    title: 'Scaling Card',
    subtitle: 'Card subtitle',
    metadataSource: undefined,
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
    template: `<lib-scaling-card [title]="title" [subtitle]="subtitle" [metadataSource]="metadataSource" [enableOverflow]="enableOverflow" [cardClass]="cardClass" [animationEntry]="animationEntry" [animationExit]="animationExit" [animationTrigger]="animationTrigger" [animationDuration]="animationDuration"><p>Sample card content projected into the default slot.</p></lib-scaling-card>`,
  }),
};
