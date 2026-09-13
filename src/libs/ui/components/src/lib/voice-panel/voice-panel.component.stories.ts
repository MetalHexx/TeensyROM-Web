import type { Meta, StoryObj } from '@storybook/angular';
import { VoicePanelComponent, VoicePanelModel } from './voice-panel.component';

const meta: Meta<VoicePanelComponent> = {
  title: 'DJ/Voice Panel',
  component: VoicePanelComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's per-voice mute/kill list: a heading, one `VoiceRowComponent` per row, and a " +
          'Clear button that resets every latched mute at once. Purely presentational — it holds no ' +
          "state of its own; the caller owns every row's mute/held state and every write.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<VoicePanelComponent>;

const model: VoicePanelModel = {
  accessibleName: 'Voice deck A',
  rows: [
    {
      label: 'V1',
      muted: false,
      holdLabel: 'Kill',
      checkboxId: 'voice-mute-0-a',
      muteAccessibleName: 'Mute voice 1 deck A',
      holdAccessibleName: 'Kill voice 1 deck A',
    },
    {
      label: 'V2',
      muted: true,
      holdLabel: 'Punch',
      checkboxId: 'voice-mute-1-a',
      muteAccessibleName: 'Mute voice 2 deck A',
      holdAccessibleName: 'Punch voice 2 deck A',
    },
    {
      label: 'V3',
      muted: false,
      holdLabel: 'Kill',
      checkboxId: 'voice-mute-2-a',
      muteAccessibleName: 'Mute voice 3 deck A',
      holdAccessibleName: 'Kill voice 3 deck A',
    },
  ],
  clearAccessibleName: 'Clear all voice mutes deck A',
};

export const Default: Story = {
  args: { model },
};
