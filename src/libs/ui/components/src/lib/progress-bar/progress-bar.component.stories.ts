import type { Meta, StoryObj } from '@storybook/angular';
import { ProgressBarComponent } from './progress-bar.component';

const meta: Meta<ProgressBarComponent> = {
  title: 'Primitives/Progress Bar',
  component: ProgressBarComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A thin (4px), absolutely-positioned progress strip meant to sit flush against the top edge of a card or panel — the kind of subtle in-progress indicator you'd use for playback position or a file transfer, not a prominent form-style progress bar. It takes `currentValue`/`totalValue` rather than a pre-computed percentage, so callers pass raw domain values (elapsed/total seconds, bytes transferred/total bytes) and the component derives the percentage itself, safely handling a zero `totalValue`. Toggle `show` to mount/unmount the bar entirely; setting `currentValue` to `0` still renders an empty bar.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<ProgressBarComponent>;

export const Default: Story = {
  args: {
    currentValue: 50,
    totalValue: 100,
    show: true,
  },
};

export const ZeroPercent: Story = {
  args: {
    currentValue: 0,
    totalValue: 100,
    show: true,
  },
};

export const FiftyPercent: Story = {
  args: {
    currentValue: 50,
    totalValue: 100,
    show: true,
  },
};

export const HundredPercent: Story = {
  args: {
    currentValue: 100,
    totalValue: 100,
    show: true,
  },
};
