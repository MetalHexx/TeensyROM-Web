import type { Meta, StoryObj } from '@storybook/angular';
import { LoopSelectedRowComponent, type LoopSelectedRowModel } from './loop-selected-row.component';
import type { LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';

const meta: Meta<LoopSelectedRowComponent> = {
  title: 'DJ/Loop Selected Row',
  component: LoopSelectedRowComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The selected loop or cue: a trigger key, a one-shot play-now key, a small display of the ' +
          'name, kind and span, the GBL switch (lit and pressed while the marker shares the main ' +
          "track's settings), an icon-only Clear End key and Delete, and beneath them the Start and " +
          "End boundaries, each headed by its In or Out key with edge-move arrows and a beat-tick nudge " +
          'strip, and under them the Length row (½, a size picker, 2×) and the Move row (earlier, a ' +
          "step picker, later). A cue's End keeps an enabled Out key. With nothing selected the " +
          'display is blank and every key and boundary is disabled, but the Move row stays live. The ' +
          "display's accessible text carries the running, queued, not-ready and " +
          'own-settings state in words. ' +
          'Presentational only: it computes no time, beat or target and holds no drag value; the ' +
          'boundary outputs are tagged with the boundary they came from. A picker with no options ' +
          '(no grid) shows its readout as plain text.',
      },
    },
  },
  argTypes: {
    model: { description: "The row's state: display text, flags, both boundaries and every name." },
    startDragOffset: { description: "While non-null, the Start boundary's readout and bar follow it." },
    endDragOffset: { description: "While non-null, the End boundary's readout and bar follow it." },
    trigger: { description: 'Emits when the trigger key is pressed.' },
    playNow: { description: 'Emits when the play-now key is pressed.' },
    toggleGlobal: { description: 'Emits when the GBL switch is pressed.' },
    toggleWrap: { description: 'Emits when the WRAP switch is pressed.' },
    setIn: { description: 'Emits when the In key is pressed.' },
    setOut: { description: 'Emits when the Out key is pressed.' },
    halve: { description: 'Emits when the ½ key is pressed.' },
    double: { description: 'Emits when the 2× key is pressed.' },
    pickLength: { description: 'Emits the picked size in beats.' },
    moveEarlier: { description: 'Emits when the Move earlier key is pressed.' },
    moveLater: { description: 'Emits when the Move later key is pressed.' },
    pickMoveStep: { description: 'Emits the picked Move step in beats.' },
    moveEdge: {
      description: "Emits when a boundary's edge-move arrow is pressed, tagged with the boundary and direction.",
    },
    clearEnd: { description: 'Emits when Clear End is pressed.' },
    deleteMarker: { description: 'Emits when Delete is pressed.' },
    nudgeInput: { description: 'Fires on every nudge drag tick, tagged with the boundary.' },
    nudgeCommit: { description: 'Fires when a nudge is released, tagged with the boundary.' },
    rename: {
      description:
        'Emits the new name with the id of the marker the edit was opened on, when the name is renamed in place; empty is allowed.',
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 474px">
        <lib-loop-selected-row
          [model]="model"
          [startDragOffset]="startDragOffset"
          [endDragOffset]="endDragOffset"
        />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopSelectedRowComponent>;

function boundary(tag: 'Start' | 'End', overrides: Partial<LoopBoundaryModel> = {}): LoopBoundaryModel {
  const side = tag.toLowerCase();
  const isStart = tag === 'Start';
  return {
    key: {
      label: isStart ? 'In' : 'Out',
      accessibleName: isStart ? 'Loop in Loop 3' : 'Loop out Loop 3',
      control: isStart ? 'loop-in' : 'loop-set-end',
      disabled: false,
    },
    empty: false,
    disabled: false,
    offsetFrames: 0,
    rangeFrames: 50,
    tickPercents: [15, 42, 77],
    nudgeAccessibleName: `Nudge ${side} of Loop 3`,
    earlierAccessibleName: `Move ${side} of Loop 3 earlier`,
    laterAccessibleName: `Move ${side} of Loop 3 later`,
    ...overrides,
  };
}

const lengthOptions = [
  { beats: 1, label: '1 BEAT', selected: false },
  { beats: 2, label: '2 BEATS', selected: false },
  { beats: 4, label: '4 BEATS', selected: false },
  { beats: 8, label: '8 BEATS', selected: false },
  { beats: 16, label: '16 BEATS', selected: true },
  { beats: 32, label: '32 BEATS', selected: false },
];

const moveStepOptions = [
  { beats: 1 as const, label: '1 BEAT', selected: true },
  { beats: 2 as const, label: '2 BEATS', selected: false },
  { beats: 4 as const, label: '4 BEATS', selected: false },
  { beats: 8 as const, label: '8 BEATS', selected: false },
  { beats: 16 as const, label: '16 BEATS', selected: false },
];

const loop: LoopSelectedRowModel = {
  id: 'm3',
  empty: false,
  name: 'Loop 3',
  kindLabel: 'LOOP',
  spanText: '02:39.4–02:47.5',
  activity: 'idle',
  ready: true,
  triggerDisabled: false,
  clearEndDisabled: false,
  deleteDisabled: false,
  start: boundary('Start', { offsetFrames: 6 }),
  end: boundary('End', { offsetFrames: -7 }),
  length: {
    text: '16 BEATS',
    options: lengthOptions,
    halveAccessibleName: 'Halve Loop 3',
    doubleAccessibleName: 'Double Loop 3',
    pickAccessibleName: 'Loop length Loop 3',
  },
  move: {
    stepText: '1 BEAT',
    options: moveStepOptions,
    earlierAccessibleName: 'Move Loop 3 earlier',
    laterAccessibleName: 'Move Loop 3 later',
    pickAccessibleName: 'Move step',
  },
  triggerAccessibleName: 'Trigger Loop 3',
  clearEndAccessibleName: 'Clear the end of Loop 3, making it a cue',
  deleteAccessibleName: 'Delete Loop 3',
  playNowDisabled: false,
  playNowAccessibleName: 'Play now Loop 3',
  sharesGlobal: true,
  globalDisabled: false,
  globalAccessibleName: 'GBL Loop 3',
  wraps: false,
  wrapDisabled: false,
  wrapAccessibleName: 'WRAP Loop 3',
  renameDisabled: false,
  renameLabel: 'Rename Loop 3',
  nameMaxLength: 48,
};

const none: LoopSelectedRowModel = {
  ...loop,
  id: null,
  empty: true,
  name: '',
  kindLabel: '',
  spanText: '',
  triggerDisabled: true,
  clearEndDisabled: true,
  deleteDisabled: true,
  playNowDisabled: true,
  globalDisabled: true,
  wrapDisabled: true,
  start: boundary('Start', {
    disabled: true,
    tickPercents: [],
    key: { ...loop.start.key, disabled: true },
  }),
  end: boundary('End', {
    empty: true,
    disabled: true,
    tickPercents: [],
    key: { ...loop.end.key, disabled: true },
  }),
  length: { ...loop.length, text: '—', options: [] },
};

const cue: LoopSelectedRowModel = {
  ...loop,
  id: 'm4',
  name: 'Cue 4',
  kindLabel: 'CUE',
  spanText: '02:43.2',
  clearEndDisabled: true,
  wrapDisabled: true,
  end: boundary('End', { empty: true, tickPercents: [] }),
  length: { ...loop.length, text: 'NO END', options: [] },
  renameLabel: 'Rename Cue 4',
  triggerAccessibleName: 'Trigger Cue 4',
  playNowAccessibleName: 'Play now Cue 4',
  globalAccessibleName: 'GBL Cue 4',
  wrapAccessibleName: 'WRAP Cue 4',
};

/** A selected loop sharing the main track's settings: GBL lit with a ringed-dot lamp, both boundaries nudged. */
export const LoopSharingGlobal: Story = {
  args: { model: loop, startDragOffset: null, endDragOffset: null },
};

/** A loop with its own settings: GBL unlit with an empty-ring lamp, and the display says "own settings" to assistive tech. */
export const LoopOwnSettings: Story = {
  args: { model: { ...loop, sharesGlobal: false }, startDragOffset: null, endDragOffset: null },
};

/** A loop that wraps a scrubbed record from its start to its end: WRAP lit with a ringed-dot lamp, and the display says "wraps" to assistive tech. */
export const Wraps: Story = {
  args: { model: { ...loop, wraps: true }, startDragOffset: null, endDragOffset: null },
};

/** A selected cue: Clear End disabled, and the End row keeps an enabled Out key beside an empty strip. */
export const CueOutKey: Story = {
  args: { model: cue, startDragOffset: null, endDragOffset: null },
};

/** A loop off the grid: its length is in seconds and the Length picker is plain text. */
export const OffGridLoop: Story = {
  args: {
    model: {
      ...loop,
      length: { ...loop.length, text: '7.8s', options: [] },
      start: boundary('Start', { tickPercents: [] }),
      end: boundary('End', { tickPercents: [] }),
    },
    startDragOffset: null,
    endDragOffset: null,
  },
};

/** No grid on the deck: both pickers are plain text, and the keys stay enabled but do nothing. */
export const NoGrid: Story = {
  args: {
    model: {
      ...loop,
      length: { ...loop.length, options: [] },
      move: { ...loop.move, options: [] },
      start: boundary('Start', { tickPercents: [] }),
      end: boundary('End', { tickPercents: [] }),
    },
    startDragOffset: null,
    endDragOffset: null,
  },
};

/** Nothing selected: blank display, every key and boundary disabled; the Move row stays live. */
export const NothingSelected: Story = {
  args: { model: none, startDragOffset: null, endDragOffset: null },
};

/** Running: the key's light is green and the display reads "running" to assistive tech. */
export const Running: Story = {
  args: {
    model: { ...loop, activity: 'running' },
    startDragOffset: -17,
    endDragOffset: null,
  },
};

/** A marker the DJ has named: the name renders in place and is renamed by clicking it. */
export const Named: Story = {
  args: {
    model: { ...loop, name: 'Chorus drop', renameLabel: 'Rename Chorus drop' },
    startDragOffset: null,
    endDragOffset: null,
  },
};

/** Mid-rename: the field spans the display, the kind and span step aside, and the counter sits at its right edge. */
export const Renaming: Story = {
  args: { model: loop, startDragOffset: null, endDragOffset: null },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('lib-inline-edit-title button')?.click();
  },
};

/** Renaming is out of reach: the name is plain text. */
export const RenameDisabled: Story = {
  args: { model: { ...loop, renameDisabled: true }, startDragOffset: null, endDragOffset: null },
};

/** The narrow layout, with the bindings panel open: the boundaries stack. */
export const Narrow: Story = {
  args: { model: loop, startDragOffset: null, endDragOffset: null },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 300px">
        <lib-loop-selected-row
          [model]="model"
          [startDragOffset]="startDragOffset"
          [endDragOffset]="endDragOffset"
        />
      </div>
    `,
  }),
};
