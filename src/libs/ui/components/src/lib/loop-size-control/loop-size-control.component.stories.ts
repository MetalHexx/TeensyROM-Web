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
          'The size control of the mixer loop rows: a tag, a ½ key, a readout that opens a picker of ' +
          'sizes, and a 2× key. The selected loop row draws it as Length, the live loop row as Size. ' +
          'Presentational only. With no options (no grid) the readout is plain text. The readout takes ' +
          'the mouse wheel only when `wheel` is on.',
      },
    },
  },
  argTypes: {
    model: { description: 'The readout text, the picker options and the accessible names.' },
    disabled: { description: 'Disables both keys and dims the readout.' },
    halveDisabled: { description: "Disables ½ alone, e.g. at the ladder's shortest rung." },
    doubleDisabled: { description: "Disables 2× alone, e.g. at the ladder's longest rung." },
    tag: { description: 'The decorative caption before the keys.' },
    wheel: { description: 'Whether the readout takes the mouse wheel.' },
    readoutControl: { description: 'The data-control id on the readout.' },
    halveControl: { description: 'The data-control id on the ½ key.' },
    doubleControl: { description: 'The data-control id on the 2× key.' },
    halve: { description: 'Emits when ½ is pressed.' },
    double: { description: 'Emits when 2× is pressed.' },
    pickLength: { description: 'Emits the picked size in beats.' },
    wheelTurn: { description: 'Emits whole wheel clicks over the readout, upward positive.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 230px">
        <lib-loop-size-control
          [model]="model"
          [tag]="tag"
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
  pickAccessibleName: 'Live loop size deck A',
};

/** A size on the ladder, with the wheel on. */
export const Idle: Story = {
  args: {
    model: size,
    tag: 'Size',
    wheel: true,
    disabled: false,
    halveDisabled: false,
    doubleDisabled: false,
  },
};

/** At the shortest rung ½ is disabled alone. */
export const AtShortest: Story = {
  args: { ...Idle.args, halveDisabled: true, model: { ...size, text: '1 BEAT' } },
};

/** No grid: the readout is plain text and the keys are off. */
export const NoGrid: Story = {
  args: { ...Idle.args, disabled: true, model: { ...size, text: '—', options: [] } },
};

/** The Length caption, as the selected loop row draws it. */
export const Length: Story = {
  args: { ...Idle.args, tag: 'Length', wheel: false },
};

/** A narrow slot. */
export const Narrow: Story = {
  args: Idle.args,
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 170px">
        <lib-loop-size-control [model]="model" [tag]="tag" [wheel]="wheel" />
      </div>
    `,
  }),
};
