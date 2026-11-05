import type { Meta, StoryObj } from '@storybook/angular';
import { LoopSizeControlComponent, type LoopLengthModel } from './loop-size-control.component';

const meta: Meta<LoopSizeControlComponent> = {
  title: 'DJ/Loop Size Control',
  component: LoopSizeControlComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The length control of the mixer loop rows: a LENGTH tag, a 1/2 key, optionally − and + ' +
          'whole-beat keys, a readout that opens a picker of lengths, and a 2× key. The selected loop ' +
          'row gives it the step keys and a No End item; the live loop row gives it neither. ' +
          'Presentational only. With no options and no No End (no grid) the readout is plain text. The ' +
          'readout takes the mouse wheel only when `wheel` is on.',
      },
    },
  },
  argTypes: {
    model: {
      description:
        'The readout text, the picker options, the accessible names, and optionally the step keys (`steps`) and the No End item (`noEnd`).',
    },
    disabled: { description: 'Disables both keys and dims the readout.' },
    halveDisabled: { description: "Disables 1/2 alone, e.g. at the ladder's shortest rung." },
    doubleDisabled: { description: "Disables 2× alone, e.g. at the ladder's longest rung." },
    wheel: { description: 'Whether the readout takes the mouse wheel.' },
    readoutControl: { description: 'The data-control id on the readout.' },
    halveControl: { description: 'The data-control id on the 1/2 key.' },
    doubleControl: { description: 'The data-control id on the 2× key.' },
    stepDownControl: { description: 'The data-control id on the − key.' },
    stepUpControl: { description: 'The data-control id on the + key.' },
    halve: { description: 'Emits when 1/2 is pressed.' },
    double: { description: 'Emits when 2× is pressed.' },
    stepLength: { description: 'Emits -1 for the − key and 1 for the + key.' },
    pickNoEnd: { description: "Emits when the picker's No End item is picked." },
    pickLength: { description: 'Emits the picked size in beats.' },
    wheelTurn: { description: 'Emits whole wheel clicks over the readout, upward positive.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 230px">
        <lib-loop-size-control
          [model]="model"
          [disabled]="disabled"
          [halveDisabled]="halveDisabled"
          [doubleDisabled]="doubleDisabled"
          [wheel]="wheel"
        />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopSizeControlComponent>;

const size: LoopLengthModel = {
  text: '4 BEATS',
  options: [
    { beats: 1, label: '1 BEAT', selected: false },
    { beats: 2, label: '2 BEATS', selected: false },
    { beats: 4, label: '4 BEATS', selected: true },
    { beats: 8, label: '8 BEATS', selected: false },
  ],
  halveAccessibleName: 'Halve live loop deck A',
  doubleAccessibleName: 'Double live loop deck A',
  pickAccessibleName: 'Live loop length deck A',
};

/** A length on the ladder, with the wheel on. */
export const Idle: Story = {
  args: {
    model: size,
    wheel: true,
    disabled: false,
    halveDisabled: false,
    doubleDisabled: false,
  },
};

/** At the shortest rung 1/2 is disabled alone. */
export const AtShortest: Story = {
  args: { ...Idle.args, halveDisabled: true, model: { ...size, text: '1 BEAT' } },
};

/** No grid: the readout is plain text and the keys are off. */
export const NoGrid: Story = {
  args: { ...Idle.args, disabled: true, model: { ...size, text: '—', options: [] } },
};

/** As the selected loop row draws it: the − and + keys, and No End first in the picker. */
export const WithStepsAndNoEnd: Story = {
  args: {
    ...Idle.args,
    wheel: false,
    model: {
      ...size,
      steps: {
        disabled: false,
        downAccessibleName: 'Shorten Loop 1 by a beat deck A',
        upAccessibleName: 'Lengthen Loop 1 by a beat deck A',
      },
      noEnd: { label: 'NO END', selected: false },
    },
  },
};

/** A cue on a tune with no grid: the readout is still a picker, for No End alone, and the step keys are off. */
export const CueWithNoGrid: Story = {
  args: {
    ...Idle.args,
    wheel: false,
    model: {
      ...size,
      text: 'NO END',
      options: [],
      steps: {
        disabled: true,
        downAccessibleName: 'Shorten Cue 1 by a beat deck A',
        upAccessibleName: 'Lengthen Cue 1 by a beat deck A',
      },
      noEnd: { label: 'NO END', selected: true },
    },
  },
};

/** A narrow slot. */
export const Narrow: Story = {
  args: Idle.args,
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 170px">
        <lib-loop-size-control [model]="model" [wheel]="wheel" />
      </div>
    `,
  }),
};
