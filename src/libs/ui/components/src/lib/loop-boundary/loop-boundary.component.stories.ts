import type { Meta, StoryObj } from '@storybook/angular';
import { LoopBoundaryComponent, type LoopBoundaryModel } from './loop-boundary.component';

const meta: Meta<LoopBoundaryComponent> = {
  title: 'DJ/Loop Boundary',
  component: LoopBoundaryComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One boundary of the selected loop or cue: the In or Out key, an edge-move arrow either way, ' +
          'a bipolar nudge strip between them and the offset readout (`0 fr`, `+6 fr`, `−7 fr`, or `—` ' +
          'when empty). The strip is a native range under a drawn strip with a centre line, magenta ' +
          'beat ticks and a bar from the centre to the value. `nudgeInput` fires on every drag tick ' +
          '(readout only), `nudgeCommit` on release. It holds no drag value: while `dragOffsetFrames` ' +
          "is non-null the readout and bar follow it. A cue's End row keeps an enabled Out key beside " +
          'an empty strip.',
      },
    },
  },
  argTypes: {
    model: { description: "The boundary's state: key, flags, offset, range, beat ticks and names." },
    dragOffsetFrames: {
      description: 'While non-null, the readout and bar follow it instead of the committed offset.',
    },
    nudgeInput: { description: 'Fires on every drag tick with the live offset in frames.' },
    nudgeCommit: { description: 'Fires on release with the offset in frames.' },
    keyPress: { description: 'Emits when the In or Out key is pressed.' },
    moveEarlier: { description: 'Emits when the move-edge-earlier arrow is pressed.' },
    moveLater: { description: 'Emits when the move-edge-later arrow is pressed.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 232px">
        <lib-loop-boundary [model]="model" [dragOffsetFrames]="dragOffsetFrames" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopBoundaryComponent>;

const base: LoopBoundaryModel = {
  key: { label: 'In', accessibleName: 'Loop in Item 3', control: 'loop-in', disabled: false },
  empty: false,
  disabled: false,
  offsetFrames: 0,
  rangeFrames: 50,
  tickPercents: [],
  nudgeAccessibleName: 'Nudge start of Item 3',
  earlierAccessibleName: 'Move start of Item 3 earlier',
  laterAccessibleName: 'Move start of Item 3 later',
};

const outKey: LoopBoundaryModel['key'] = {
  label: 'Out',
  accessibleName: 'Loop out Item 3',
  control: 'loop-set-end',
  disabled: false,
};

/** Centred: no nudge, no beats in reach. */
export const Centred: Story = { args: { model: base, dragOffsetFrames: null } };

/** Nudged six frames late, with beats of the grid in reach. */
export const NudgedWithBeatTicks: Story = {
  args: {
    model: { ...base, offsetFrames: 6, tickPercents: [12, 38, 71, 90] },
    dragOffsetFrames: null,
  },
};

/** The End row of a loop, headed by the Out key. */
export const OutKey: Story = {
  args: {
    model: { ...base, key: outKey, tickPercents: [30, 80] },
    dragOffsetFrames: null,
  },
};

/** A cue's End: an enabled Out key, an empty strip, readout `—`, arrows disabled. */
export const CueEnd: Story = {
  args: {
    model: { ...base, key: outKey, empty: true },
    dragOffsetFrames: null,
  },
};

/** Nothing selected: every control disabled, the key included. */
export const Disabled: Story = {
  args: {
    model: { ...base, disabled: true, key: { ...base.key, disabled: true } },
    dragOffsetFrames: null,
  },
};

/** Mid-drag: the readout and bar follow the caller's drag offset, not the committed one. */
export const MidDrag: Story = {
  args: {
    model: { ...base, offsetFrames: 6, tickPercents: [12, 38, 71, 90] },
    dragOffsetFrames: -17,
  },
};

/** The narrow layout, with the bindings panel open. */
export const Narrow: Story = {
  args: {
    model: { ...base, offsetFrames: 6, tickPercents: [12, 38, 71, 90] },
    dragOffsetFrames: null,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 300px">
        <lib-loop-boundary [model]="model" [dragOffsetFrames]="dragOffsetFrames" />
      </div>
    `,
  }),
};
