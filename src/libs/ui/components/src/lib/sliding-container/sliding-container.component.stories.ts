import type { Meta, StoryObj } from '@storybook/angular';
import { SlidingContainerComponent } from './sliding-container.component';

const meta: Meta<SlidingContainerComponent> = {
  title: 'Layout/Sliding Container',
  component: SlidingContainerComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Height/width expansion animation wrapper — its content pushes and pulls ' +
          'surrounding elements as it expands or collapses, unlike the transform-based ' +
          '`ScalingContainerComponent` and `FadingContainerComponent`, which never affect ' +
          'layout. Choose this when the animated content should participate in document ' +
          'flow (e.g. a toolbar that pushes the page down as it slides in). Like the other ' +
          'animation containers, it both consumes a parent\'s completion signal and ' +
          'provides its own via `PARENT_ANIMATION_COMPLETE`, so children opted in with ' +
          '`animationParent` wait for it in turn — see the Animation System entry for the ' +
          'full mechanism.',
      },
    },
  },
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
