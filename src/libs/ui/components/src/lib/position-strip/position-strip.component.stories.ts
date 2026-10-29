import type { Meta, StoryObj } from '@storybook/angular';
import { PositionStripComponent, type PositionMark } from './position-strip.component';

const meta: Meta<PositionStripComponent> = {
  title: 'DJ/Position Strip',
  component: PositionStripComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One continuous bar, lit up to the position, with a loop mark and a playhead, over a ' +
          'native range input that does the scrubbing — so a click anywhere, a drag, the arrow ' +
          'keys, Home and End all work, and the drag is continuous. Purely presentational: it ' +
          'holds no drag-pin state, so `positionPercent` is whatever the caller shows, and ' +
          '`scrubInput` (every drag tick, a preview) and ' +
          '`scrubCommit` (release only, the one that seeks) are how the caller hears what the ' +
          'operator did. The bar before the loop point is intro purple, after it music cyan, ' +
          'with an amber mark at the loop point; an ended tune goes dim after its music; an ' +
          'unknown structure is all cyan; analyzing is dim and disabled.',
      },
    },
  },
  argTypes: {
    barState: { description: 'How the bar is coloured and whether a loop mark appears.' },
    positionPercent: { description: '0–100: the live playhead, or the caller’s drag pin.' },
    accessibleName: { description: "The range's accessible name, e.g. 'Position deck A'." },
    held: { description: 'A finger is on this deck’s record: the playhead turns warning amber.' },
    valueText: { description: "The range's aria-valuetext, e.g. '01:23.4 of 03:12'." },
    marks: {
      description:
        'Loop brackets and cue ticks in a lane above the strip. null reserves no lane; an array, ' +
        'even an empty one, does. The lane takes no pointer or keyboard input.',
    },
    scrubInput: { description: 'Every drag tick — a preview, never a seek.' },
    scrubCommit: { description: 'Release only — the one that seeks.' },
  },
};

export default meta;
type Story = StoryObj<PositionStripComponent>;

const base = {
  accessibleName: 'Position deck A',
  valueText: '01:23.4 of 03:12',
  marks: null as readonly PositionMark[] | null,
  held: false,
};

const wrapped: Story['render'] = (args) => ({
  props: args,
  template: `
    <div style="width: 420px">
      <lib-position-strip
        [barState]="barState"
        [positionPercent]="positionPercent"
        [accessibleName]="accessibleName"
        [valueText]="valueText"
        [marks]="marks"
        [held]="held"
      />
    </div>
  `,
});

/** A loop with a 25% intro: purple before the amber mark, cyan after it. */
export const Loop: Story = {
  args: { ...base, barState: { kind: 'loop', introPercent: 25 }, positionPercent: 40 },
  render: wrapped,
};

/** A tune that ends: cyan up to 70%, dim after it. */
export const Ended: Story = {
  args: { ...base, barState: { kind: 'ended', musicPercent: 70 }, positionPercent: 85 },
  render: wrapped,
};

/** The structure is unknown: all cyan. */
export const Unknown: Story = {
  args: { ...base, barState: { kind: 'unknown' }, positionPercent: 55 },
  render: wrapped,
};

/** Nothing looked for yet: dim and disabled — clicking or pressing keys does nothing. */
export const Analyzing: Story = {
  args: { ...base, barState: { kind: 'analyzing' }, positionPercent: 0, valueText: null },
  render: wrapped,
};

/** A drag pinned at 62%: `positionPercent` is the caller's pin rather than the live playhead. */
export const MidDrag: Story = {
  args: {
    ...base,
    barState: { kind: 'loop', introPercent: 25 },
    positionPercent: 62,
    valueText: '01:59.0 of 03:12',
  },
  render: wrapped,
};

function mark(id: string, overrides: Partial<PositionMark>): PositionMark {
  return {
    id,
    kind: 'loop',
    startPercent: 10,
    endPercent: 22,
    activity: 'idle',
    selected: false,
    ...overrides,
  };
}

/** The marks lane reserved with nothing in it yet. */
export const MarksEmptyLane: Story = {
  args: { ...base, barState: { kind: 'loop', introPercent: 25 }, positionPercent: 40, marks: [] },
  render: wrapped,
};

/** An idle loop and an idle cue. */
export const MarksIdle: Story = {
  args: {
    ...base,
    barState: { kind: 'loop', introPercent: 25 },
    positionPercent: 40,
    marks: [
      mark('loop', { startPercent: 12, endPercent: 30 }),
      mark('cue', { kind: 'cue', startPercent: 60, endPercent: null }),
    ],
  },
  render: wrapped,
};

/** Every state at once: idle, selected, running, queued, and selected with running. */
export const MarksEveryState: Story = {
  args: {
    ...base,
    barState: { kind: 'loop', introPercent: 25 },
    positionPercent: 40,
    marks: [
      mark('idle', { startPercent: 2, endPercent: 10 }),
      mark('idle-cue', { kind: 'cue', startPercent: 14, endPercent: null }),
      mark('selected', { startPercent: 18, endPercent: 28, selected: true }),
      mark('selected-cue', { kind: 'cue', startPercent: 32, endPercent: null, selected: true }),
      mark('running', { startPercent: 36, endPercent: 46, activity: 'running' }),
      mark('queued', { startPercent: 50, endPercent: 60, activity: 'queued' }),
      mark('queued-cue', { kind: 'cue', startPercent: 64, endPercent: null, activity: 'queued' }),
      mark('both', { startPercent: 70, endPercent: 82, activity: 'running', selected: true }),
    ],
  },
  render: wrapped,
};

/** A finger on the strip: the playhead is amber, beside marks in every state. */
export const Held: Story = {
  args: {
    ...base,
    barState: { kind: 'loop', introPercent: 25 },
    positionPercent: 40,
    held: true,
    marks: [
      mark('idle', { startPercent: 4, endPercent: 14 }),
      mark('queued', { startPercent: 18, endPercent: 28, activity: 'queued' }),
      mark('running', { startPercent: 52, endPercent: 64, activity: 'running' }),
      mark('selected', { kind: 'cue', startPercent: 72, endPercent: null, selected: true }),
    ],
  },
  render: wrapped,
};

/** A working scrubber: click or drag anywhere on the strip, or use the arrow keys, Home and End.
 *  The position follows every preview; the commit is the release. */
export const Interactive: Story = {
  args: { ...base, barState: { kind: 'loop', introPercent: 25 }, positionPercent: 40 },
  render: (args) => ({
    props: {
      ...args,
      onScrubInput(percent: number) {
        this['positionPercent'] = percent;
      },
      onScrubCommit(percent: number) {
        this['positionPercent'] = percent;
      },
    },
    template: `
      <div style="width: 420px">
        <lib-position-strip
          [barState]="barState"
          [positionPercent]="positionPercent"
          [accessibleName]="accessibleName"
          [valueText]="valueText"
          [marks]="marks"
          (scrubInput)="onScrubInput($event)"
          (scrubCommit)="onScrubCommit($event)"
        />
      </div>
    `,
  }),
};

/** Keyboard focus ring. */
export const Focused: Story = {
  args: { ...base, barState: { kind: 'loop', introPercent: 25 }, positionPercent: 40 },
  render: wrapped,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector('input')?.focus();
  },
};
