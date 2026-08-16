import type { Meta, StoryObj } from '@storybook/angular';
import { FadingContainerComponent } from './fading-container.component';

const meta: Meta<FadingContainerComponent> = {
  title: 'Layout/Fading Container',
  component: FadingContainerComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Simple opacity+blur fade animation wrapper — no transforms, no directional ' +
          'movement, no layout impact. Because it uses no CSS transforms, this is the best ' +
          'choice for content styled with `backdrop-filter` (glassy effects): browsers ' +
          'render `backdrop-filter` smoothly during opacity-only animation, avoiding the ' +
          '"blur pop-in" artifact transform-based animation can cause. Use ' +
          '`ScalingContainerComponent` instead for a transform-based "pop" effect, or ' +
          '`SlidingContainerComponent` when the content should expand/collapse and push ' +
          'surrounding layout. Like the other animation containers, it both consumes a ' +
          'parent\'s completion signal and provides its own via ' +
          '`PARENT_ANIMATION_COMPLETE`, so children opted in with `animationParent` wait ' +
          'for it in turn — see the Animation System entry for the full mechanism.',
      },
    },
  },
  argTypes: {
    animationTrigger: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<FadingContainerComponent>;

export const Default: Story = {
  args: {
    animationTrigger: true,
    animationDuration: 200,
    animationParent: undefined,
  },
  render: (args) => ({
    props: args,
    template: `<lib-fading-container [animationTrigger]="animationTrigger" [animationDuration]="animationDuration"><p>Toggle the animationTrigger control to play the enter/exit transition.</p></lib-fading-container>`,
  }),
};
