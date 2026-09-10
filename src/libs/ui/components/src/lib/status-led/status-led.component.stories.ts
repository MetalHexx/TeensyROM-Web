import type { Meta, StoryObj } from '@storybook/angular';
import { StatusLedComponent } from './status-led.component';

const meta: Meta<StatusLedComponent> = {
  title: 'DJ/Status LED',
  component: StatusLedComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A colored dot plus its adjacent text label — a compact state readout for a deck's " +
          "transport. Distinct from `StatusIconLabelComponent`, which pairs a Material *icon* with " +
          'text; reach for this one when the indicator is a plain colored LED rather than an icon ' +
          'glyph.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<StatusLedComponent>;

export const Playing: Story = {
  args: { state: 'playing', label: 'Playing' },
};

export const Stopped: Story = {
  args: { state: 'stopped', label: 'Stopped' },
};

export const Paused: Story = {
  args: { state: 'paused', label: 'Paused' },
};

export const Ended: Story = {
  args: { state: 'ended', label: 'Ended' },
};

export const Analyzing: Story = {
  args: { state: 'analyzing', label: 'Analyzing…' },
};

export const ErrorState: Story = {
  args: { state: 'error', label: 'Error' },
};
