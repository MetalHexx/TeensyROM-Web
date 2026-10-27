import type { Meta, StoryObj } from '@storybook/angular';
import { LoopTileComponent, type LoopTileModel } from './loop-tile.component';

const meta: Meta<LoopTileComponent> = {
  title: 'DJ/Loop Tile',
  component: LoopTileComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact loop or cue tile: a trigger key whose state light shows idle (dark), queued ' +
          '(amber, blinking, steady under reduced motion) or running (green), a one-shot play-now ' +
          'key (bolt), and a select button ' +
          "over the name, the length and the tile's own timeline. A loop's timeline fills to " +
          '`progressPercent` with a playhead while running; a cue draws a single magenta tick. A ' +
          'selected tile carries `aria-current` and a cyan ring; a tile that is not ready draws a ' +
          'dashed, dim timeline and says so in its accessible name. A small lit dot beside the name ' +
          'marks a marker that keeps its own settings; it is decorative, so the caller adds the ' +
          'same fact to the select name. Presentational only: the caller supplies every label and ' +
          'the progress.',
      },
    },
  },
  argTypes: {
    model: { description: "The tile's state: id, name, kind, length text, activity, flags and names." },
    progressPercent: { description: '0–100; drawn only while the tile is running.' },
    trigger: { description: 'Emits when the trigger key is pressed.' },
    playNow: { description: 'Emits when the play-now key is pressed.' },
    selectTile: { description: 'Emits when the select button is pressed.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 232px">
        <lib-loop-tile [model]="model" [progressPercent]="progressPercent" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopTileComponent>;

const base: LoopTileModel = {
  id: 'loop-3',
  name: 'Item 3',
  kind: 'loop',
  lengthText: '7.8s',
  activity: 'idle',
  selected: false,
  ready: true,
  triggerAccessibleName: 'Trigger Item 3',
  selectAccessibleName: 'Select Item 3, loop, 7.8 seconds, idle',
  ownSettings: false,
  playNowAccessibleName: 'Play now Item 3',
};

/** An idle loop. */
export const Idle: Story = { args: { model: base, progressPercent: 0 } };

/** A marker with its own settings: the lit dot beside the name, against a sharing twin below. */
export const OwnSettings: Story = {
  args: {
    model: {
      ...base,
      ownSettings: true,
      selectAccessibleName: 'Select Item 3, loop, 7.8 seconds, own settings',
    },
    progressPercent: 0,
  },
  render: (args) => ({
    props: { ...args, sharing: base },
    template: `
      <div style="width: 232px; display: flex; flex-direction: column; gap: 8px">
        <lib-loop-tile [model]="model" [progressPercent]="progressPercent" />
        <lib-loop-tile [model]="sharing" [progressPercent]="0" />
      </div>
    `,
  }),
};

/** A marker the DJ has named, beside an unnamed one: the name takes the tile's name line as is. */
export const NamedAndUnnamed: Story = {
  args: {
    model: {
      ...base,
      id: 'loop-5',
      name: 'Chorus drop',
      triggerAccessibleName: 'Trigger Chorus drop',
      selectAccessibleName: 'Select Chorus drop, loop, 7.8 seconds, idle',
      playNowAccessibleName: 'Play now Chorus drop',
    },
    progressPercent: 0,
  },
  render: (args) => ({
    props: { ...args, unnamed: base },
    template: `
      <div style="width: 232px; display: flex; flex-direction: column; gap: 8px">
        <lib-loop-tile [model]="model" [progressPercent]="progressPercent" />
        <lib-loop-tile [model]="unnamed" [progressPercent]="0" />
      </div>
    `,
  }),
};

/** The selected tile: cyan ring and `aria-current`. */
export const Selected: Story = { args: { model: { ...base, selected: true }, progressPercent: 0 } };

/** Queued: the key's light is amber and blinks (steady under reduced motion). */
export const Queued: Story = {
  args: {
    model: {
      ...base,
      activity: 'queued',
      selectAccessibleName: 'Select Item 3, loop, 7.8 seconds, queued',
    },
    progressPercent: 0,
  },
};

/** Running at 53%: green light, filled timeline and playhead. */
export const Running: Story = {
  args: {
    model: {
      ...base,
      activity: 'running',
      selected: true,
      selectAccessibleName: 'Select Item 3, loop, 7.8 seconds, running',
    },
    progressPercent: 53,
  },
};

/** Not ready: a dashed, dim timeline; the accessible name says so. */
export const NotReady: Story = {
  args: {
    model: {
      ...base,
      ready: false,
      selectAccessibleName: 'Select Item 3, loop, 7.8 seconds, not ready',
    },
    progressPercent: 0,
  },
};

/** A cue: a single magenta tick instead of a span. */
export const Cue: Story = {
  args: {
    model: {
      ...base,
      id: 'cue-4',
      name: 'Item 4',
      kind: 'cue',
      lengthText: 'CUE',
      triggerAccessibleName: 'Trigger Item 4',
      selectAccessibleName: 'Select Item 4, cue, idle',
    },
    progressPercent: 0,
  },
};

/** The narrow layout, with the bindings panel open. */
export const Narrow: Story = {
  args: { model: { ...base, selected: true, activity: 'running' }, progressPercent: 53 },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 150px">
        <lib-loop-tile [model]="model" [progressPercent]="progressPercent" />
      </div>
    `,
  }),
};
