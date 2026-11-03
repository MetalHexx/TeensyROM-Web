import type { Meta, StoryObj } from '@storybook/angular';
import { DeckChannelStripComponent, DeckChannelStripModel } from './deck-channel-strip.component';

const meta: Meta<DeckChannelStripComponent> = {
  title: 'DJ/Deck Channel Strip',
  component: DeckChannelStripComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's voice-and-speed channel strip on a single faceplate: three voice pairs " +
          '(a latching mute key over a Kill/Punch hold pad), the speed display, a hardware-drawn ' +
          'fader that is still a native range, the nudge pads and the jump keys. The speed display ' +
          'carries the BPM under the percent, and a Tap key sits under it. It is sized for ' +
          'the roughly 88px voice-and-speed column and fills its height. A sign at the top of the ' +
          'voice section names whose settings are in play. Purely presentational. ' +
          'The Held story presses the pads with an Enter keydown.',
      },
    },
  },
  argTypes: {
    model: { description: 'Everything the strip draws.' },
    mutedChange: {
      description: 'A mute key was pressed; carries the voice index and the new mute.',
    },
    heldChange: { description: 'A Kill/Punch pad was pressed or released.' },
    faderChange: { description: 'The fader moved; the raw value.' },
    faderWheel: {
      description:
        'The wheel turned over the fader; whole clicks (upward positive) and their time.',
    },
    nudgeChange: { description: 'A nudge pad was pressed or released.' },
    jump: { description: 'A jump key was pressed; carries its id.' },
    tap: { description: 'The Tap key was pressed.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 88px; height: 580px; display: flex; flex-direction: column">
        <lib-deck-channel-strip [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<DeckChannelStripComponent>;

function baseModel(deck: 'A' | 'B' = 'A'): DeckChannelStripModel {
  return {
    settingsSign: {
      text: 'Main',
      own: false,
      accessibleName: `Settings in play deck ${deck}: Main`,
    },
    voiceAccessibleName: `Voice deck ${deck}`,
    speedAccessibleName: `Speed deck ${deck}`,
    voices: [1, 2, 3].map((n) => ({
      label: `V${n}`,
      muted: false,
      holdLabel: 'Kill',
      muteAccessibleName: `Mute voice ${n} deck ${deck}`,
      holdAccessibleName: `Kill voice ${n} deck ${deck}`,
    })),
    speedText: '0.00%',
    nudging: false,
    tapping: false,
    tapAccessibleName: `Tap the beat deck ${deck}`,
    fader: {
      value: 1,
      min: 0.5,
      max: 1.5,
      step: 0.0001,
      home: 1,
      accessibleName: `Speed multiplier deck ${deck}`,
      valueText: '0.00%',
    },
    nudge: {
      downAccessibleName: `Nudge speed down deck ${deck}`,
      upAccessibleName: `Nudge speed up deck ${deck}`,
    },
    jumpButtons: [
      { id: 'up', label: '+50%', accessibleName: `Speed up 50% deck ${deck}` },
      { id: 'home', label: 'Home', accessibleName: `Speed home deck ${deck}` },
      { id: 'down', label: '−50%', accessibleName: `Speed down 50% deck ${deck}` },
    ],
    disabled: false,
  };
}

const pressWithEnter = (canvasElement: HTMLElement, name: string): void => {
  canvasElement
    .querySelector(`[aria-label="${name}"]`)
    ?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
};

export const AtRest: Story = { args: { model: baseModel() } };

/** The BPM line under the percent is set live by a painter, not by the model. */
export const WithBpm: Story = {
  args: { model: baseModel() },
  play: async ({ canvasElement }) => {
    const bpm = canvasElement.querySelector('.bpm');
    if (bpm) {
      bpm.textContent = '125.31 BPM';
    }
  },
};

/** The speed display and the Tap key take the nudge's magenta while the deck is tapping. */
export const Tapping: Story = { args: { model: { ...baseModel(), tapping: true } } };

/** The speed display tints magenta while a nudge is in effect; the fader does not move. */
export const Nudging: Story = {
  args: { model: { ...baseModel(), nudging: true, speedText: '+4.00%' } },
};

/** Deck B holding a Kill pad and nudge plus. */
export const Held: Story = {
  args: { model: { ...baseModel('B'), nudging: true, speedText: '+4.00%' } },
  play: async ({ canvasElement }) => {
    pressWithEnter(canvasElement, 'Kill voice 2 deck B');
    pressWithEnter(canvasElement, 'Nudge speed up deck B');
  },
};

export const MutedVoice: Story = {
  args: {
    model: {
      ...baseModel(),
      voices: baseModel().voices.map((voice, i) => ({ ...voice, muted: i === 1 })),
    },
  },
};

/** A marker's own settings in play: the sign is lit cyan and names the marker. */
export const OwnSettingsSign: Story = {
  args: {
    model: {
      ...baseModel(),
      settingsSign: {
        text: 'Loop 2',
        own: true,
        accessibleName: 'Settings in play deck A: Loop 2',
      },
    },
  },
};

export const Disabled: Story = { args: { model: { ...baseModel(), disabled: true } } };
