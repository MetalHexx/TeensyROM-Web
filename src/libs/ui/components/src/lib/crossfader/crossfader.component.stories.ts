import type { Meta, StoryObj } from '@storybook/angular';
import { CrossfaderComponent } from './crossfader.component';

const meta: Meta<CrossfaderComponent> = {
  title: 'DJ/Crossfader',
  component: CrossfaderComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The fader and its two end labels only — no per-deck gain fader, no curve selector, no ' +
          'curve preview, and no numeric readout of the resulting register value. Purely ' +
          'presentational: it holds no local copy of its value and never re-rounds what it reads ' +
          'off the native range input. Reach for it wherever a mix needs to blend two labeled ' +
          'sources along a single bipolar axis. `trackLength` pins the track to a fixed extent and ' +
          'moves the two deck-letter labels to a row above it, for a host that already constrains ' +
          "the card's height.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<CrossfaderComponent>;

export const Default: Story = {
  args: {
    value: 0,
    startLabel: 'A',
    endLabel: 'B',
    accessibleName: 'Crossfader, deck A to deck B',
  },
};

/** `trackLength` set: the deck-letter labels move to a row above the track, and the track itself
 *  is pinned to `trackLength` rather than growing with its container. */
export const FixedTrack: Story = {
  args: {
    value: 0,
    startLabel: 'A',
    endLabel: 'B',
    accessibleName: 'Crossfader, deck A to deck B',
    trackLength: '148px',
  },
};
