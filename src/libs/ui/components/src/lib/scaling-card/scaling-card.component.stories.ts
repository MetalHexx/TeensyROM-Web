import type { Meta, StoryObj } from '@storybook/angular';
import { ScalingCardComponent } from './scaling-card.component';

const meta: Meta<ScalingCardComponent> = {
  title: 'Layout/Scaling Card',
  component: ScalingCardComponent,
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
