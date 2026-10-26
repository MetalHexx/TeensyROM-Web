import type { Meta, StoryObj } from '@storybook/angular';
import {
  LoopBoundaryComponent,
  type LoopBoundaryAction,
  type LoopBoundaryModel,
} from './loop-boundary.component';

const meta: Meta<LoopBoundaryComponent> = {
  title: 'DJ/Loop Boundary',
  component: LoopBoundaryComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One boundary of the selected loop or cue: a tag, a previous-snap key, a bipolar nudge strip, " +
          'a next-snap key and the offset readout (`0 fr`, `+6 fr`, `−7 fr`, or `—` when empty). The ' +
          'strip is a native range under a drawn strip with a centre line, magenta moment ticks and ' +
          'a bar from the centre to the value. `nudgeInput` fires on every drag tick (readout only), ' +
          '`nudgeCommit` on release. It holds no drag value: while `dragOffsetFrames` is non-null the ' +
          'readout and bar follow it. With an `action` the boundary keeps its frame and tag but holds ' +
          "one full-width one-shot key in place of the snap keys, strip and readout — a cue's End " +
          'slot uses it for Set End.',
      },
    },
  },
  argTypes: {
    model: { description: "The boundary's state: tag, flags, offset, range, ticks and names." },
    dragOffsetFrames: {
      description: 'While non-null, the readout and bar follow it instead of the committed offset.',
    },
    nudgeInput: { description: 'Fires on every drag tick with the live offset in frames.' },
    nudgeCommit: { description: 'Fires on release with the offset in frames.' },
    snapPrevious: { description: 'Emits when the previous-moment snap key is pressed.' },
    snapNext: { description: 'Emits when the next-moment snap key is pressed.' },
    action: {
      description:
        "When set, replaces the snap keys, strip and readout with this one-shot key. Carries the key's label, icon, accessible name, disabled flag and data-control.",
    },
    actionPress: { description: 'Emits when the action key is pressed.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 232px">
        <lib-loop-boundary [model]="model" [dragOffsetFrames]="dragOffsetFrames" [action]="action ?? null" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopBoundaryComponent>;

const base: LoopBoundaryModel = {
  tag: 'Start',
  empty: false,
  disabled: false,
  offsetFrames: 0,
  rangeFrames: 50,
  tickPercents: [],
  previousDisabled: false,
  nextDisabled: false,
  nudgeAccessibleName: 'Nudge start of Item 3',
  previousAccessibleName: 'Snap start of Item 3 to the previous moment',
  nextAccessibleName: 'Snap start of Item 3 to the next moment',
};

const setEnd: LoopBoundaryAction = {
  label: 'Set End',
  icon: 'last_page',
  accessibleName: 'Set the end of Item 4 here',
  disabled: false,
  control: 'loop-set-end',
};

/** Centred: no nudge, no moments in reach. */
export const Centred: Story = { args: { model: base, dragOffsetFrames: null } };

/** Nudged six frames late, with detected moments in reach. */
export const NudgedWithTicks: Story = {
  args: {
    model: { ...base, offsetFrames: 6, tickPercents: [12, 38, 71, 90] },
    dragOffsetFrames: null,
  },
};

/** A cue's End: drawn empty, readout `—`, every control disabled. */
export const EmptyEnd: Story = {
  args: {
    model: { ...base, tag: 'End', empty: true },
    dragOffsetFrames: null,
  },
};

/** A cue's End slot: the frame and tag stay, and one full-width Set End key replaces the rest. */
export const WithAction: Story = {
  args: {
    model: { ...base, tag: 'End', empty: true },
    dragOffsetFrames: null,
    action: setEnd,
  },
};

/** The action key disabled. */
export const ActionDisabled: Story = {
  args: {
    model: { ...base, tag: 'End', empty: true },
    dragOffsetFrames: null,
    action: { ...setEnd, disabled: true },
  },
};

/** Mid-drag: the readout and bar follow the caller's drag offset, not the committed one. */
export const MidDrag: Story = {
  args: {
    model: { ...base, offsetFrames: 6, tickPercents: [12, 38, 71, 90] },
    dragOffsetFrames: -17,
  },
};

/** Both snap keys disabled: no detected moment on either side. */
export const SnapsDisabled: Story = {
  args: {
    model: { ...base, offsetFrames: -7, previousDisabled: true, nextDisabled: true },
    dragOffsetFrames: null,
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
