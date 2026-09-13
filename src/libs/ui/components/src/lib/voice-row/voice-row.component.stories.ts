import type { Meta, StoryObj } from '@storybook/angular';
import { VoiceRowComponent, VoiceRowModel } from './voice-row.component';

const meta: Meta<VoiceRowComponent> = {
  title: 'DJ/Voice Row',
  component: VoiceRowComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One voice's mute/kill controls: a checkbox for the latched mute, checkbox and label on " +
          'one line, and a momentary hold button beneath them that inverts the latched mute for as ' +
          "long as it's held — by pointer or by Enter/Space. Purely presentational: `holdLabel` is " +
          "the caller's own resolved verb, unaffected by whether the button is currently held.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<VoiceRowComponent>;

function rowModel(muted: boolean): VoiceRowModel {
  return {
    label: 'V1',
    muted,
    holdLabel: muted ? 'Punch' : 'Kill',
    checkboxId: 'voice-row-story-checkbox',
    muteAccessibleName: 'Mute voice 1 deck A',
    holdAccessibleName: muted ? 'Punch voice 1 deck A' : 'Kill voice 1 deck A',
  };
}

export const Audible: Story = {
  args: { model: rowModel(false) },
};

export const Muted: Story = {
  args: { model: rowModel(true) },
};
