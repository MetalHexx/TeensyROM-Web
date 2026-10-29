import type { Meta, StoryObj } from '@storybook/angular';
import { DeckTransportComponent, DeckTransportModel } from './deck-transport.component';

const meta: Meta<DeckTransportComponent> = {
  title: 'DJ/Deck Transport',
  component: DeckTransportComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's transport on its own faceplate: a display of what is loaded and where it " +
          'is, the continuous position bar (still a working scrubber), and the Play/Pause, Stop, ' +
          'Repeat and subtune keys. Purely presentational. It lays itself out by its own width, ' +
          'not the viewport’s: three identical keys at the start of the row and the stepper at ' +
          'the end, labelled from about 436px and icon-only from about 336px; below that the ' +
          'same icon-only keys with the stepper on its own row, and the frame number hidden. ' +
          'Every state story below shows the transport at 560, 400 and 300px. An error replaces ' +
          'the display, and each reason is a `role="alert"` line.',
      },
    },
  },
  argTypes: {
    model: { description: 'Everything the transport draws that does not move per frame.' },
    positionPercent: { description: '0–100: the live playhead, or the caller’s drag pin.' },
    elapsedText: { description: "The elapsed time, 'mm:ss.t'." },
    frameLabel: { description: "The frame readout, e.g. 'frame 1234'." },
    playPauseClick: { description: 'The Play/Pause key was pressed.' },
    stopClick: { description: 'The Stop key was pressed.' },
    repeatTrackChange: { description: 'The Repeat key was pressed; carries the new latch.' },
    previousInSet: { description: 'The set row’s previous key was pressed.' },
    nextInSet: { description: 'The set row’s next key was pressed.' },
    previousSubtune: { description: 'The stepper’s previous key was pressed.' },
    nextSubtune: { description: 'The stepper’s next key was pressed.' },
    scrubInput: { description: 'Every drag tick on the strip — a preview, never a seek.' },
    scrubCommit: { description: 'Release on the strip — the one that seeks.' },
  },
};

export default meta;
type Story = StoryObj<DeckTransportComponent>;

/** A stopped deck with a three-subtune tune loaded — every story below overrides one group. */
function baseModel(): DeckTransportModel {
  return {
    accessibleName: 'Transport deck A',
    state: 'stopped',
    stateLabel: 'Stop',
    held: false,
    title: 'Last Ninja 2 - The Wilderness',
    author: 'Ben Daglish',
    emptyText: 'No tune — drop a SID here',
    totalText: '03:12',
    bar: { kind: 'loop', introPercent: 25 },
    marks: [],
    scrubAccessibleName: 'Position deck A',
    playPause: { showing: 'play', disabled: false },
    canStop: true,
    repeatTrack: true,
    subtune: {
      text: '1/3',
      disabled: false,
      previousAccessibleName: 'Previous subtune deck A',
      nextAccessibleName: 'Next subtune deck A',
    },
    actionAccessibleNames: {
      play: 'Play deck A',
      pause: 'Pause deck A',
      stop: 'Stop deck A',
      repeat: 'Repeat track deck A',
    },
    errors: [],
    set: {
      positionText: '02/08',
      setName: 'Friday warm-up',
      previousDisabled: false,
      nextDisabled: false,
      previousAccessibleName: 'Previous in the set deck A',
      nextAccessibleName: 'Next in the set deck A',
    },
  };
}

const playingModel = (): DeckTransportModel => ({
  ...baseModel(),
  state: 'playing',
  stateLabel: 'Play',
  playPause: { showing: 'pause', disabled: false },
});

const WIDTHS = [560, 400, 300];

/** The transport at 560, 400 and 300px, stacked, so all three layouts read side by side. */
const atEveryWidth: Story['render'] = (args) => ({
  props: { ...args, widths: WIDTHS },
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem">
      @for (width of widths; track width) {
        <div [style.width.px]="width">
          <lib-deck-transport
            [model]="model"
            [positionPercent]="positionPercent"
            [elapsedText]="elapsedText"
            [frameLabel]="frameLabel"
          />
        </div>
      }
    </div>
  `,
});

export const Playing: Story = {
  args: {
    model: playingModel(),
    positionPercent: 42,
    elapsedText: '01:20.7',
    frameLabel: 'frame 4035',
  },
  render: atEveryWidth,
};

/** The Play key's amber light blinks (steady under reduced motion). */
export const Paused: Story = {
  args: {
    model: { ...baseModel(), state: 'paused', stateLabel: 'Pause' },
    positionPercent: 42,
    elapsedText: '01:20.7',
    frameLabel: 'frame 4035',
  },
  render: atEveryWidth,
};

/** A finger is on the strip: the state word reads Held and its light is steady amber, over a
 *  paused deck — the Play key keeps its own blinking amber light. */
export const Held: Story = {
  args: {
    model: { ...baseModel(), state: 'paused', stateLabel: 'Held', held: true },
    positionPercent: 42,
    elapsedText: '01:20.7',
    frameLabel: 'frame 4035',
  },
  render: atEveryWidth,
};

export const Stopped: Story = {
  args: { model: baseModel(), positionPercent: 0, elapsedText: '00:00.0', frameLabel: 'frame 0' },
  render: atEveryWidth,
};

/** Loop brackets and cue ticks along the strip: a running selected loop, a queued one, a cue. */
export const WithMarks: Story = {
  args: {
    model: {
      ...playingModel(),
      marks: [
        {
          id: 'a',
          kind: 'loop',
          startPercent: 18,
          endPercent: 34,
          activity: 'running',
          selected: true,
        },
        {
          id: 'b',
          kind: 'loop',
          startPercent: 48,
          endPercent: 60,
          activity: 'queued',
          selected: false,
        },
        {
          id: 'c',
          kind: 'cue',
          startPercent: 78,
          endPercent: null,
          activity: 'idle',
          selected: false,
        },
      ],
    },
    positionPercent: 26,
    elapsedText: '00:50.0',
    frameLabel: 'frame 2500',
  },
  render: atEveryWidth,
};

/** Play is out of reach, Stop is disabled and the strip is disabled while the scan runs. */
export const Analyzing: Story = {
  args: {
    model: {
      ...baseModel(),
      state: 'analyzing',
      stateLabel: 'Analyzing…',
      bar: { kind: 'analyzing' },
      playPause: { showing: 'play', disabled: true },
      canStop: false,
    },
    positionPercent: 0,
    elapsedText: '00:00.0',
    frameLabel: 'frame 0',
  },
  render: atEveryWidth,
};

/** Nothing loaded: the empty text in place of the title, no length, nothing to play. */
export const Empty: Story = {
  args: {
    model: {
      ...baseModel(),
      state: 'empty',
      title: null,
      author: null,
      totalText: '--:--',
      bar: { kind: 'unknown' },
      playPause: { showing: 'play', disabled: true },
      canStop: false,
      repeatTrack: false,
      subtune: { ...baseModel().subtune, text: '-/-', disabled: true },
    },
    positionPercent: 0,
    elapsedText: '00:00.0',
    frameLabel: 'frame 0',
  },
  render: atEveryWidth,
};

/** A failed deck: the reasons replace the display, each one a `role="alert"` line. */
export const Errored: Story = {
  args: {
    model: {
      ...baseModel(),
      state: 'error',
      stateLabel: 'Error',
      bar: { kind: 'unknown' },
      playPause: { showing: 'play', disabled: true },
      canStop: false,
      errors: ['Delivery stalled.', 'Not a valid SID file.'],
    },
    positionPercent: 0,
    elapsedText: '00:00.0',
    frameLabel: 'frame 0',
  },
  render: atEveryWidth,
};

/** A tune that ends, with a title and author long enough to truncate with an ellipsis. */
export const LongTitle: Story = {
  args: {
    model: {
      ...playingModel(),
      title: 'Wizball - Title Music (Extended Remix With A Very Long Name)',
      author: 'Martin Galway and the Ocean Software Sound Team',
      bar: { kind: 'ended', musicPercent: 70 },
    },
    positionPercent: 85,
    elapsedText: '02:43.2',
    frameLabel: 'frame 8160',
  },
  render: atEveryWidth,
};

/** A deck on the second of eight rows: both set keys reachable, the position and set name read out. */
export const OnASetRow: Story = {
  args: {
    model: playingModel(),
    positionPercent: 42,
    elapsedText: '01:20.7',
    frameLabel: 'frame 4035',
  },
  render: atEveryWidth,
};

/** A deck on the first row: Previous in the set is disabled. */
export const AtTheFirstRow: Story = {
  args: {
    model: {
      ...playingModel(),
      set: {
        ...baseModel().set,
        positionText: '01/08',
        previousDisabled: true,
      },
    },
    positionPercent: 42,
    elapsedText: '01:20.7',
    frameLabel: 'frame 4035',
  },
  render: atEveryWidth,
};

/** A deck with no set: the dashes stand in for the position and both keys are disabled. */
export const WithNoSet: Story = {
  args: {
    model: {
      ...playingModel(),
      set: {
        ...baseModel().set,
        positionText: '— / —',
        setName: '',
        previousDisabled: true,
        nextDisabled: true,
      },
    },
    positionPercent: 42,
    elapsedText: '01:20.7',
    frameLabel: 'frame 4035',
  },
  render: atEveryWidth,
};

const TOTAL_SECONDS = 192;

/** `mm:ss.t` of a position percent of a 03:12 tune. */
function elapsedFor(percent: number): string {
  const tenths = Math.round((percent / 100) * TOTAL_SECONDS * 10);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}.${tenths % 10}`;
}

/** A working scrubber: click or drag the strip and the position, the lit bar and the elapsed
 *  time follow; the arrow keys, Home and End work once it has focus. */
export const MidScrub: Story = {
  args: {
    model: playingModel(),
    positionPercent: 42,
    elapsedText: elapsedFor(42),
    frameLabel: 'frame 4035',
  },
  render: (args) => ({
    props: {
      ...args,
      onScrub(percent: number) {
        this['positionPercent'] = percent;
        this['elapsedText'] = elapsedFor(percent);
        this['frameLabel'] = `frame ${Math.round((percent / 100) * TOTAL_SECONDS * 50)}`;
      },
    },
    template: `
      <div style="width: 400px">
        <lib-deck-transport
          [model]="model"
          [positionPercent]="positionPercent"
          [elapsedText]="elapsedText"
          [frameLabel]="frameLabel"
          (scrubInput)="onScrub($event)"
          (scrubCommit)="onScrub($event)"
        />
      </div>
    `,
  }),
};
