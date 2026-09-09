import type { Meta, StoryObj } from '@storybook/angular';
import { ChannelFaderComponent } from './channel-fader.component';

const meta: Meta<ChannelFaderComponent> = {
  title: 'DJ/Channel Fader',
  component: ChannelFaderComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single vertical range fader with an optional label rendered beneath it. Bounds ' +
          '(`min`/`max`/`step`) are inputs rather than fixed at 0–1 gain, so this same fader can ' +
          "back a deck's channel gain or a differently-scoped bounded control elsewhere in the app " +
          "— it holds no local state and never re-rounds the value it reads off the native range " +
          'input.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<ChannelFaderComponent>;

export const Default: Story = {
  args: {
    value: 1,
    accessibleName: 'Channel fader deck A',
    label: 'A',
  },
};
