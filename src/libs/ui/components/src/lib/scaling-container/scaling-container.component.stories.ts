import type { Meta, StoryObj } from '@storybook/angular';
import { ScalingContainerComponent } from './scaling-container.component';

const meta: Meta<ScalingContainerComponent> = {
  title: 'Layout/Scaling Container',
  component: ScalingContainerComponent,
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
type Story = StoryObj<ScalingContainerComponent>;

export const Default: Story = {
  args: {
    animationEntry: 'from-top',
    animationExit: 'from-top',
    animationTrigger: true,
    animationDuration: 2000,
    animationParent: undefined,
  },
  render: (args) => ({
    props: args,
    template: `<lib-scaling-container [animationEntry]="animationEntry" [animationExit]="animationExit" [animationTrigger]="animationTrigger" [animationDuration]="animationDuration"><p>Toggle the animationTrigger control to play the enter/exit transition.</p></lib-scaling-container>`,
  }),
};
