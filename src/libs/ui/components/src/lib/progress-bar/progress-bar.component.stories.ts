import type { Meta, StoryObj } from '@storybook/angular';
import { ProgressBarComponent } from './progress-bar.component';

const meta: Meta<ProgressBarComponent> = {
  title: 'Primitives/Progress Bar',
  component: ProgressBarComponent,
  tags: ['autodocs'],
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
