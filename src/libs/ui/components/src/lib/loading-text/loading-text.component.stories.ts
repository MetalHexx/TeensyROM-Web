import type { Meta, StoryObj } from '@storybook/angular';
import { LoadingTextComponent } from './loading-text.component';

const meta: Meta<LoadingTextComponent> = {
  title: 'Primitives/Loading Text',
  component: LoadingTextComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A ready-to-use loading indicator: fades in/out on `visible`, cycles the text through a leet-speak wave animation while shown, and optionally shows a spinning `/ - \\ |` glyph. It's `LeetTextContainerComponent` with the fade lifecycle and text projection already wired up, so most call sites should reach for this rather than composing `LeetTextContainerComponent` by hand — corner-slot loading indicators, autosave/processing status messages, and any spot that toggles between idle and busy. Drop down to `LeetTextContainerComponent` directly only when you need the cycling animation without the fade transition.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<LoadingTextComponent>;

export const Default: Story = {
  args: {
    visible: true,
    text: 'Loading...',
    showSpinner: true,
    animationDuration: 1000,
  },
};
