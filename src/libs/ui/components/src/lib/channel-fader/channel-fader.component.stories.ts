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
          "input. `size` steps the label font and the width the host reserves; the native range " +
          "input's own thumb and track are the browser's and do not scale. `length` pins the " +
          "input's own travel to a fixed CSS length instead of growing with its container.",
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

/** All four `ControlSize` steps side by side, each with a fixed `length` so the travel is
 *  comparable regardless of the surrounding story canvas. */
export const Sizes: Story = {
  render: () => ({
    template: `
      <div style="display: flex; align-items: flex-end; gap: 24px; height: 160px;">
        <lib-channel-fader [value]="1" accessibleName="Small demo" label="S" size="small" length="120px" />
        <lib-channel-fader [value]="1" accessibleName="Medium demo" label="M" size="medium" length="120px" />
        <lib-channel-fader [value]="1" accessibleName="Large demo" label="L" size="large" length="120px" />
        <lib-channel-fader [value]="1" accessibleName="Extra Large demo" label="XL" size="extra-large" length="120px" />
      </div>
    `,
  }),
};
