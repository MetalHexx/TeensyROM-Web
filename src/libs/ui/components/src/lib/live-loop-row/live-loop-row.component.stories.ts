import type { Meta, StoryObj } from '@storybook/angular';
import { LiveLoopRowComponent, type LiveLoopRowModel } from './live-loop-row.component';

const meta: Meta<LiveLoopRowComponent> = {
  title: 'DJ/Live Loop Row',
  component: LiveLoopRowComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The live loop row at the top of a deck's loops/cues plate, in a bordered tray that lights " +
          'green while the loop runs: the Live loop key, the SIZE ' +
          'control (1/2, a size picker, 2×, with the mouse wheel on the readout) and the latching SLIP ' +
          'key. The Live loop key acts on press: a quick click leaves the loop running, and a press ' +
          'held for 300 ms or more ends the loop it started when released. Presentational only.',
      },
    },
  },
  argTypes: {
    model: { description: "The row's state: running, disabled, size, ladder ends, slip and names." },
    toggleLiveLoop: { description: 'Emits when the Live loop key goes down.' },
    endLiveLoop: { description: 'Emits when a press that started the loop is released after a hold.' },
    halve: { description: 'Emits when 1/2 is pressed.' },
    double: { description: 'Emits when 2× is pressed.' },
    pickSize: { description: 'Emits the picked size in beats.' },
    sizeWheel: { description: 'Emits whole wheel clicks over the size readout, upward positive.' },
    toggleSlip: { description: 'Emits when SLIP is pressed.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 474px">
        <lib-live-loop-row [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LiveLoopRowComponent>;

const idle: LiveLoopRowModel = {
  running: false,
  disabled: false,
  liveLoopAccessibleName: 'Live loop deck A',
  size: {
    text: '4 BEATS',
    options: [
      { beats: 1, label: '1 BEAT', selected: false },
      { beats: 2, label: '2 BEATS', selected: false },
      { beats: 4, label: '4 BEATS', selected: true },
      { beats: 8, label: '8 BEATS', selected: false },
    ],
    halveAccessibleName: 'Halve live loop deck A',
    doubleAccessibleName: 'Double live loop deck A',
    pickAccessibleName: 'Live loop size deck A',
  },
  canHalve: true,
  canDouble: true,
  slip: false,
  slipAccessibleName: 'Slip deck A',
};

/** No live loop: the key's light is dark and SLIP is off. */
export const Idle: Story = { args: { model: idle } };

/** The live loop is running: the tray's border and rim glow green and the Live loop key's light is on. */
export const Running: Story = { args: { model: { ...idle, running: true } } };

/** SLIP latched: its lamp is a ringed dot. */
export const SlipOn: Story = { args: { model: { ...idle, slip: true } } };

/** No grid: every control is off and the readout is blank. */
export const NoGrid: Story = {
  args: {
    model: {
      ...idle,
      disabled: true,
      canHalve: false,
      canDouble: false,
      size: { ...idle.size, text: '—', options: [] },
    },
  },
};

/** At the longest rung 2× is disabled alone. */
export const AtLongest: Story = {
  args: { model: { ...idle, canDouble: false, size: { ...idle.size, text: '8 BEATS' } } },
};

/** The narrow layout, with the bindings panel open: the size control takes its own line. */
export const Narrow: Story = {
  args: { model: { ...idle, running: true } },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 300px">
        <lib-live-loop-row [model]="model" />
      </div>
    `,
  }),
};
