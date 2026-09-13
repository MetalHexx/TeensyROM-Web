import type { Meta, StoryObj } from '@storybook/angular';
import { TransportPanelComponent, TransportPanelModel } from './transport-panel.component';

const meta: Meta<TransportPanelComponent> = {
  title: 'DJ/Transport Panel',
  component: TransportPanelComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's transport, in two lines, three with POC affordances: position bar and frame " +
          'readout; transport buttons, repeat toggle, subtune stepper and state LED; and, only when ' +
          '`showFilePicker` is set or the model carries `tuneSources`, a third line of tune-source ' +
          'buttons and the file picker. Purely presentational — it composes ' +
          '`ScrubPositionBarComponent`, `StatusLedComponent` and `StepperComponent`, holds no state ' +
          'of its own beyond resetting its file input, and leaves every gate, label and accessible ' +
          'name to the caller that builds the model.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<TransportPanelComponent>;

/** A stopped deck with a tune loaded, a single subtune and nothing wrong — every story below is
 *  this with one group overridden. */
function baseModel(): TransportPanelModel {
  return {
    accessibleName: 'Transport deck A',
    bar: { kind: 'loop', introPercent: 25 },
    scrubAccessibleName: 'Position deck A',
    transport: { state: 'stopped', label: 'Stopped' },
    canPlay: true,
    canPause: false,
    canStop: true,
    repeatTrack: true,
    tuneSources: [
      { id: 'auto', label: 'Auto Tune', accessibleName: 'Auto Tune deck A' },
      { id: 'amiga', label: 'Amiga Tune', accessibleName: 'Amiga Tune deck A' },
    ],
    subtune: {
      text: 'Subtune 1 of 1',
      disabled: true,
      previousAccessibleName: 'Previous subtune deck A',
      nextAccessibleName: 'Next subtune deck A',
    },
    actionAccessibleNames: {
      play: 'Play deck A',
      pause: 'Pause deck A',
      stop: 'Stop deck A',
      repeat: 'Repeat track deck A',
      chooseFile: 'Choose file deck A',
    },
    errors: [],
  };
}

/** No POC affordances: no `showFilePicker`, and a model with no tune sources — just the position
 *  bar and the transport row, subtune stepper beside the LED. */
export const Default: Story = {
  args: {
    model: { ...baseModel(), tuneSources: [] },
    positionPercent: 0,
    frameLabel: 'frame 0',
  },
};

/** The POC's own affordances: `showFilePicker` set, with tune sources on the model — the third
 *  line renders both the tune buttons and Choose File. */
export const WithPoCAffordances: Story = {
  args: {
    model: baseModel(),
    positionPercent: 0,
    frameLabel: 'frame 0',
    showFilePicker: true,
  },
};

export const Stopped: Story = {
  args: { model: baseModel(), positionPercent: 0, frameLabel: 'frame 0' },
};

export const Playing: Story = {
  args: {
    model: {
      ...baseModel(),
      transport: { state: 'playing', label: 'Playing' },
      canPlay: false,
      canPause: true,
    },
    positionPercent: 42,
    frameLabel: 'frame 2100',
  },
};

export const Analyzing: Story = {
  args: {
    model: {
      ...baseModel(),
      bar: { kind: 'analyzing' },
      transport: { state: 'analyzing', label: 'Analyzing…' },
      canPlay: false,
      canStop: false,
    },
    positionPercent: 0,
    frameLabel: 'frame 0',
  },
};

export const Errored: Story = {
  args: {
    model: {
      ...baseModel(),
      bar: { kind: 'unknown' },
      transport: { state: 'error', label: 'Error' },
      canPlay: false,
      canStop: false,
      errors: ['Delivery stalled.', 'Not a valid SID file.'],
    },
    positionPercent: 0,
    frameLabel: 'frame 0',
  },
};

export const MultipleSubtunes: Story = {
  args: {
    model: {
      ...baseModel(),
      transport: { state: 'playing', label: 'Playing' },
      canPlay: false,
      canPause: true,
      subtune: {
        text: 'Subtune 2 of 5',
        disabled: false,
        previousAccessibleName: 'Previous subtune deck A',
        nextAccessibleName: 'Next subtune deck A',
      },
    },
    positionPercent: 60,
    frameLabel: 'frame 3000',
  },
};
