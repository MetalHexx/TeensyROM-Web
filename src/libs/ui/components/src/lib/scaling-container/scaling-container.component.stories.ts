import type { Meta, StoryObj } from '@storybook/angular';
import { ScalingContainerComponent } from './scaling-container.component';

const meta: Meta<ScalingContainerComponent> = {
  title: 'Layout/Scaling Container',
  component: ScalingContainerComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Scale+fade+slide "pop-in" animation wrapper. Transform-based — it never affects ' +
          'document flow, unlike `SlidingContainerComponent`, and content (including ' +
          'corner-slotted elements) is never clipped during animation. Prefer ' +
          '`FadingContainerComponent` instead when content uses `backdrop-filter` glassy ' +
          'styling, which renders more smoothly under opacity-only animation than under ' +
          'this component\'s transforms. Like the other animation containers, it both ' +
          'consumes a parent\'s completion signal and provides its own via ' +
          '`PARENT_ANIMATION_COMPLETE`, so children opted in with `animationParent` wait ' +
          'for it in turn — see the Animation System entry for the full mechanism.',
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
