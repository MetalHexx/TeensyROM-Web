import type { Meta, StoryObj } from '@storybook/angular';
import { LoopSelectedRowComponent, type LoopSelectedRowModel } from './loop-selected-row.component';

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
          "track's settings), the WRAP switch and Delete, and beneath them the Length row (1/2, − " +
          'and + whole-beat keys, a length picker that opens with No End, 2×) and the Move row ' +
          '(earlier, a step picker, later). With nothing selected the display is blank and every ' +
          'key is disabled, but the Move row stays live. The display\'s accessible text carries the ' +
          'running, queued, not-ready and own-settings state in words. Presentational only: it ' +
          'computes no time, beat or target. A Length picker with no sizes (no grid) shows its ' +
          'readout as plain text unless it offers No End.',
      },
    },
  },
  argTypes: {
    model: { description: "The row's state: display text, flags, the Length and Move rows and every name." },
    trigger: { description: 'Emits when the trigger key is pressed.' },
    playNow: { description: 'Emits when the play-now key is pressed.' },
    toggleGlobal: { description: 'Emits when the GBL switch is pressed.' },
    toggleWrap: { description: 'Emits when the WRAP switch is pressed.' },
    halve: { description: 'Emits when the 1/2 key is pressed.' },
    double: { description: 'Emits when the 2× key is pressed.' },
    stepLength: { description: 'Emits -1 for the − key and 1 for the + key.' },
    pickLength: { description: 'Emits the picked size in beats.' },
    moveEarlier: { description: 'Emits when the Move earlier key is pressed.' },
    moveLater: { description: 'Emits when the Move later key is pressed.' },
    pickMoveStep: { description: 'Emits the picked Move step in beats.' },
    clearEnd: { description: "Emits when the Length picker's No End item is picked." },
    deleteMarker: { description: 'Emits when Delete is pressed.' },
    rename: {
      description:
        'Emits the new name with the id of the marker the edit was opened on, when the name is renamed in place; empty is allowed.',
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 474px">
        <lib-loop-selected-row [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopSelectedRowComponent>;

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

const loopSteps = {
  disabled: false,
  downAccessibleName: 'Shorten Loop 3 by a beat deck A',
  upAccessibleName: 'Lengthen Loop 3 by a beat deck A',
};

const loop: LoopSelectedRowModel = {
  id: 'm3',
  empty: false,
  name: 'Loop 3',
  kindLabel: 'LOOP',
  spanText: '02:39.4–02:47.5',
  activity: 'idle',
  ready: true,
  triggerDisabled: false,
  deleteDisabled: false,
  length: {
    text: '16 BEATS',
    options: lengthOptions,
    halveAccessibleName: 'Halve Loop 3',
    doubleAccessibleName: 'Double Loop 3',
    pickAccessibleName: 'Loop length Loop 3',
    steps: loopSteps,
    noEnd: { label: 'NO END', selected: false },
  },
  move: {
    stepText: '1 BEAT',
    options: moveStepOptions,
    earlierAccessibleName: 'Move Loop 3 earlier',
    laterAccessibleName: 'Move Loop 3 later',
    pickAccessibleName: 'Move step',
  },
  triggerAccessibleName: 'Trigger Loop 3',
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
  deleteDisabled: true,
  playNowDisabled: true,
  globalDisabled: true,
  wrapDisabled: true,
  length: {
    text: '—',
    options: [],
    halveAccessibleName: loop.length.halveAccessibleName,
    doubleAccessibleName: loop.length.doubleAccessibleName,
    pickAccessibleName: loop.length.pickAccessibleName,
    steps: { ...loopSteps, disabled: true },
  },
};

const cue: LoopSelectedRowModel = {
  ...loop,
  id: 'm4',
  name: 'Cue 4',
  kindLabel: 'CUE',
  spanText: '02:43.2',
  wrapDisabled: true,
  length: {
    ...loop.length,
    text: 'NO END',
    options: [],
    steps: { ...loopSteps, disabled: true },
    noEnd: { label: 'NO END', selected: true },
  },
  renameLabel: 'Rename Cue 4',
  triggerAccessibleName: 'Trigger Cue 4',
  playNowAccessibleName: 'Play now Cue 4',
  globalAccessibleName: 'GBL Cue 4',
  wrapAccessibleName: 'WRAP Cue 4',
};

/** A selected loop sharing the main track's settings: GBL lit with a ringed-dot lamp. */
export const LoopSharingGlobal: Story = {
  args: { model: loop },
};

/** A loop with its own settings: GBL unlit with an empty-ring lamp, and the display says "own settings" to assistive tech. */
export const LoopOwnSettings: Story = {
  args: { model: { ...loop, sharesGlobal: false } },
};

/** A loop that wraps a scrubbed record from its start to its end: WRAP lit with a ringed-dot lamp, and the display says "wraps" to assistive tech. */
export const Wraps: Story = {
  args: { model: { ...loop, wraps: true } },
};

/** A selected cue: the − and + keys are off, and the Length picker marks No End. */
export const Cue: Story = {
  args: { model: cue },
};

/** A loop off the grid: its length is in seconds and the Length picker offers No End alone. */
export const OffGridLoop: Story = {
  args: {
    model: {
      ...loop,
      length: { ...loop.length, text: '7.8s', options: [] },
    },
  },
};

/** No grid on the deck: the Move picker is plain text, the Length picker offers No End alone, and the keys stay enabled but do nothing. */
export const NoGrid: Story = {
  args: {
    model: {
      ...loop,
      length: { ...loop.length, options: [] },
      move: { ...loop.move, options: [] },
    },
  },
};

/** Nothing selected: blank display, every key disabled; the Move row stays live. */
export const NothingSelected: Story = {
  args: { model: none },
};

/** Running: the key's light is green and the display reads "running" to assistive tech. */
export const Running: Story = {
  args: {
    model: { ...loop, activity: 'running' },
  },
};

/** A marker the DJ has named: the name renders in place and is renamed by clicking it. */
export const Named: Story = {
  args: {
    model: { ...loop, name: 'Chorus drop', renameLabel: 'Rename Chorus drop' },
  },
};

/** Mid-rename: the field spans the display, the kind and span step aside, and the counter sits at its right edge. */
export const Renaming: Story = {
  args: { model: loop },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('lib-inline-edit-title button')?.click();
  },
};

/** Renaming is out of reach: the name is plain text. */
export const RenameDisabled: Story = {
  args: { model: { ...loop, renameDisabled: true } },
};

/** The narrow layout, with the bindings panel open: the Length and Move rows stack. */
export const Narrow: Story = {
  args: { model: loop },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 300px">
        <lib-loop-selected-row [model]="model" />
      </div>
    `,
  }),
};
