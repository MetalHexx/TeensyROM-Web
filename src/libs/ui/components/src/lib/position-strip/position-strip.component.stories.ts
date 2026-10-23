import type { Meta, StoryObj } from '@storybook/angular';
import { PositionStripComponent } from './position-strip.component';

const meta: Meta<PositionStripComponent> = {
  title: 'DJ/Position Strip',
  component: PositionStripComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A row of 60 lit segments with a loop mark and a playhead, over a native range input ' +
          'that does the scrubbing — so a click anywhere, a drag, the arrow keys, Home and End all ' +
          'work. Purely presentational: it holds no drag-pin state, so `positionPercent` is ' +
          'whatever the caller shows, and `scrubInput` (every drag tick, a preview) and ' +
          '`scrubCommit` (release only, the one that seeks) are how the caller hears what the ' +
          'operator did. Segments before the loop point are intro purple, after it music cyan, ' +
          'with an amber mark at the loop point; an ended tune goes dim after its music; an ' +
          'unknown structure is all cyan; analyzing is dim and disabled.',
      },
    },
  },
  argTypes: {
    barState: { description: 'How the segments are coloured and whether a loop mark appears.' },
    positionPercent: { description: '0–100: the live playhead, or the caller’s drag pin.' },
    accessibleName: { description: "The range's accessible name, e.g. 'Position deck A'." },
    valueText: { description: "The range's aria-valuetext, e.g. '01:23.4 of 03:12'." },
    segments: { description: 'How many segments the strip is divided into.' },
    scrubInput: { description: 'Every drag tick — a preview, never a seek.' },
    scrubCommit: { description: 'Release only — the one that seeks.' },
  },
};

export default meta;
type Story = StoryObj<PositionStripComponent>;

const base = {
  accessibleName: 'Position deck A',
  valueText: '01:23.4 of 03:12',
  segments: 60,
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
        [segments]="segments"
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
          [segments]="segments"
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
