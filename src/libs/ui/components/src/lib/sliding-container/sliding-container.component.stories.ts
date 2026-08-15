import type { Meta, StoryObj } from '@storybook/angular';
import { SlidingContainerComponent } from './sliding-container.component';

const meta: Meta<SlidingContainerComponent> = {
  title: 'Layout/Sliding Container',
  component: SlidingContainerComponent,
  tags: ['autodocs'],
  argTypes: {
    animationDirection: {
      control: 'select',
      options: ['from-top', 'from-bottom', 'slide-down', 'slide-up', 'fade'],
    },
    animationTrigger: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<SlidingContainerComponent>;

export const Default: Story = {
  args: {
    containerHeight: 'auto',
    containerWidth: 'auto',
    animationDuration: 400,
    animationDirection: 'from-top',
    animationTrigger: true,
    animationParent: undefined,
  },
  render: (args) => ({
    props: args,
    template: `<lib-sliding-container [containerHeight]="containerHeight" [containerWidth]="containerWidth" [animationDuration]="animationDuration" [animationDirection]="animationDirection" [animationTrigger]="animationTrigger"><p>Toggle the animationTrigger control to play the enter/exit transition.</p></lib-sliding-container>`,
  }),
};
