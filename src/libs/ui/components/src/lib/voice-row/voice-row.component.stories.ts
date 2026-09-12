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
          "One voice's mute/kill controls: a checkbox for the latched mute, a caption reporting " +
          'whether the voice is currently audible or muted, and a momentary hold button that ' +
          "inverts the latched mute for as long as it's held — by pointer or by Enter/Space. Purely " +
          'presentational: it never resolves latched-XOR-held itself, so these stories do that on ' +
          "the caller's behalf to show the hold button visibly doing something while held.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<VoiceRowComponent>;

function rowModel(muted: boolean, held: boolean): VoiceRowModel {
  const effectiveMuted = muted !== held;
  return {
    label: 'V1',
    muted,
    stateText: effectiveMuted ? 'muted' : 'audible',
    holdLabel: muted ? 'Punch In' : 'Kill',
    checkboxId: 'voice-row-story-checkbox',
    muteAccessibleName: 'Mute voice 1 deck A',
    holdAccessibleName: muted ? 'Punch in voice 1 deck A' : 'Kill voice 1 deck A',
  };
}

export const Audible: Story = {
  render: () => ({
    props: {
      model: rowModel(false, false),
      onHeldChange(held: boolean) {
        this['model'] = rowModel(false, held);
      },
    },
    template: `<lib-voice-row [model]="model" (heldChange)="onHeldChange($event)" />`,
  }),
};

export const Muted: Story = {
  render: () => ({
    props: {
      model: rowModel(true, false),
      onHeldChange(held: boolean) {
        this['model'] = rowModel(true, held);
      },
    },
    template: `<lib-voice-row [model]="model" (heldChange)="onHeldChange($event)" />`,
  }),
};
