import type { Meta, StoryObj } from '@storybook/angular';
import { ScalingCompactCardComponent } from './scaling-compact-card.component';

const meta: Meta<ScalingCompactCardComponent> = {
  title: 'Layout/Scaling Compact Card',
  component: ScalingCompactCardComponent,
  tags: ['autodocs'],
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
