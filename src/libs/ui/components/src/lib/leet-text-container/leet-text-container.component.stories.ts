import type { Meta, StoryObj } from '@storybook/angular';
import { LeetTextContainerComponent } from './leet-text-container.component';

const meta: Meta<LeetTextContainerComponent> = {
  title: 'Primitives/Leet Text Container',
  component: LeetTextContainerComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The raw retro/demoscene text animation: projected content continuously cycles individual characters into leet-speak substitutes as a wave sweeps forward and back through the text, with optional spinner glyphs on either side. It has no fade lifecycle — the text is either animating or it isn't. Most call sites want `LoadingTextComponent` instead, which wraps this component with a fade-in/fade-out driven by a `visible` flag; reach for `LeetTextContainerComponent` directly only when the cycling text should stay visible continuously, or when `animationParent` is needed to chain into a custom animation sequence (see the Animation System conventions used across the animated containers).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<LeetTextContainerComponent>;

export const Default: Story = {
  args: {
    animationTrigger: true,
    animationDuration: 1000,
    animationParent: undefined,
    showFrontSpinner: false,
    showBackSpinner: false,
  },
  render: (args) => ({
    props: args,
    template: `<lib-leet-text-container [animationTrigger]="animationTrigger" [animationDuration]="animationDuration" [animationParent]="animationParent" [showFrontSpinner]="showFrontSpinner" [showBackSpinner]="showBackSpinner">Loading Data</lib-leet-text-container>`,
  }),
};
