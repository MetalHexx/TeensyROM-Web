import type { Meta, StoryObj } from '@storybook/angular';
import { DeckStripComponent, DeckStripModel } from './deck-strip.component';

const meta: Meta<DeckStripComponent> = {
  title: 'DJ/Deck Strip',
  component: DeckStripComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's whole control strip, top to bottom: filter mode, then every knob in the " +
          "model's own order, then the channel fader. Purely presentational — composes " +
          '`FilterModeSelectorComponent`, one `RotaryKnobComponent` per knob and ' +
          '`ChannelFaderComponent`, and holds no state of its own; the caller owns every value and ' +
          "every write. `size` forwards to the filter selector, every knob and the fader; " +
          "`faderLength` pins the fader's own travel and stops the wrapper's grow-with-floor " +
          'behavior along with it.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<DeckStripComponent>;

const model: DeckStripModel = {
  filter: {
    engaged: 'lowPass',
    groupAccessibleName: 'Filter mode deck A',
    optionAccessibleNames: {
      lowPass: 'Filter mode low-pass deck A',
      bandPass: 'Filter mode band-pass deck A',
      highPass: 'Filter mode high-pass deck A',
      off: 'Filter mode off deck A',
    },
  },
  knobs: [
    { id: 'cutoff', label: 'Cutoff', accessibleName: 'Cutoff deck A', value: 0.3 },
    { id: 'resonance', label: 'Resonance', accessibleName: 'Resonance deck A', value: -0.2 },
    { id: 'pulseWidth', label: 'Pulse Width', accessibleName: 'Pulse Width deck A', value: 0 },
    {
      id: 'key',
      label: 'Key',
      accessibleName: 'Key deck A',
      value: 3,
      min: -12,
      max: 12,
      step: 1,
      readout: '+3',
    },
  ],
  fader: { value: 0.8, accessibleName: 'Channel fader deck A', label: 'A' },
};

export const Default: Story = {
  args: { model },
};

/** All four `ControlSize` steps side by side, each rendering the same model. */
export const Sizes: Story = {
  render: () => ({
    props: { model },
    template: `
      <div style="display: flex; align-items: flex-start; gap: 24px;">
        <lib-deck-strip [model]="model" size="small" />
        <lib-deck-strip [model]="model" size="medium" />
        <lib-deck-strip [model]="model" size="large" />
        <lib-deck-strip [model]="model" size="extra-large" />
      </div>
    `,
  }),
};
