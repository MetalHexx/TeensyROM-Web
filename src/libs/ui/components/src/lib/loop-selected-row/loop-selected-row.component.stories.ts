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
          "End boundaries. On a cue the End slot holds the Set End key instead of the snap keys and " +
          'strip. With nothing selected the display is blank and every key and boundary is ' +
          "disabled. The display's accessible text carries the running, queued, not-ready and " +
          'own-settings state in words. ' +
          'Presentational only: it computes no time or snap target and holds no drag value; the ' +
          'boundary outputs are tagged with the boundary they came from.',
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
    setEnd: { description: "Emits when Set End, in a cue's End slot, is pressed." },
    clearEnd: { description: 'Emits when Clear End is pressed.' },
    deleteMarker: { description: 'Emits when Delete is pressed.' },
    nudgeInput: { description: 'Fires on every nudge drag tick, tagged with the boundary.' },
    nudgeCommit: { description: 'Fires when a nudge is released, tagged with the boundary.' },
    rename: { description: 'Emits the new name when the name is renamed in place; empty is allowed.' },
    snap: { description: 'Emits when a snap key is pressed, tagged with the boundary and direction.' },
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
  return {
    tag,
    empty: false,
    disabled: false,
    offsetFrames: 0,
    rangeFrames: 50,
    tickPercents: [15, 42, 77],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: `Nudge ${side} of Item 3`,
    previousAccessibleName: `Snap ${side} of Item 3 to the previous moment`,
    nextAccessibleName: `Snap ${side} of Item 3 to the next moment`,
    ...overrides,
  };
}

const loop: LoopSelectedRowModel = {
  empty: false,
  name: 'Item 3',
  kindLabel: 'LOOP',
  spanText: '02:39.4–02:47.5',
  activity: 'idle',
  ready: true,
  triggerDisabled: false,
  setEndDisabled: false,
  clearEndDisabled: false,
  deleteDisabled: false,
  start: boundary('Start', { offsetFrames: 6 }),
  end: boundary('End', { offsetFrames: -7 }),
  triggerAccessibleName: 'Trigger Item 3',
  setEndAccessibleName: 'Set the end of Item 3 here',
  clearEndAccessibleName: 'Clear the end of Item 3, making it a cue',
  deleteAccessibleName: 'Delete Item 3',
  playNowDisabled: false,
  playNowAccessibleName: 'Play now Item 3',
  sharesGlobal: true,
  globalDisabled: false,
  globalAccessibleName: 'GBL Item 3',
  renameDisabled: false,
  renameLabel: 'Rename Item 3',
  nameMaxLength: 48,
};

const none: LoopSelectedRowModel = {
  ...loop,
  empty: true,
  name: '',
  kindLabel: '',
  spanText: '',
  triggerDisabled: true,
  setEndDisabled: true,
  clearEndDisabled: true,
  deleteDisabled: true,
  playNowDisabled: true,
  globalDisabled: true,
  start: boundary('Start', { disabled: true, tickPercents: [] }),
  end: boundary('End', { empty: true, disabled: true, tickPercents: [] }),
};

const cue: LoopSelectedRowModel = {
  ...loop,
  name: 'Item 4',
  kindLabel: 'CUE',
  spanText: '02:43.2',
  clearEndDisabled: true,
  end: boundary('End', { empty: true, tickPercents: [] }),
  renameLabel: 'Rename Item 4',
  triggerAccessibleName: 'Trigger Item 4',
  playNowAccessibleName: 'Play now Item 4',
  globalAccessibleName: 'GBL Item 4',
};

/** A selected loop sharing the main track's settings: GBL lit with a ringed-dot lamp, both boundaries nudged. */
export const LoopSharingGlobal: Story = {
  args: { model: loop, startDragOffset: null, endDragOffset: null },
};

/** A loop with its own settings: GBL unlit with an empty-ring lamp, and the display says "own settings" to assistive tech. */
export const LoopOwnSettings: Story = {
  args: { model: { ...loop, sharesGlobal: false }, startDragOffset: null, endDragOffset: null },
};

/** A selected cue: Clear End disabled, and the End slot holds Set End in place of the snap keys. */
export const CueSetEndSlot: Story = {
  args: { model: cue, startDragOffset: null, endDragOffset: null },
};

/** Nothing selected: blank display, every key and boundary disabled. */
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
