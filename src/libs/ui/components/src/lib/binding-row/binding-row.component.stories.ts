import { componentWrapperDecorator } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { BindingRowAmount, BindingRowComponent, BindingRowModel } from './binding-row.component';

const meta: Meta<BindingRowComponent> = {
  title: 'DJ/Binding Row',
  component: BindingRowComponent,
  tags: ['autodocs'],
  decorators: [
    componentWrapperDecorator(
      (story) =>
        `<div style="width: 340px; padding: 12px; border-radius: 10px; background: #231e22; color: #e9e0e4;">${story}</div>`
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'One MIDI binding in a list: the control it drives, where it listens and how it ' +
          'behaves. Collapsed, it is two lines — the name, a style chip and the edit and delete ' +
          'buttons, then the source. Expanded in place, it frames itself in the highlight colour ' +
          'and offers the style (or Action) as a segmented control, a Trigger control where the ' +
          'style has one, the amount where the style takes one (a hand adds a second, Grip), and Re-learn source and Delete. Each amount is a native number input that emits on `change` ' +
          'only for a finite value within its range; anything else shows an inline error. A ' +
          '`statusText` — e.g. that the controller is not connected — dims the row and says why. ' +
          'Purely presentational: the caller owns the model, including `expanded`.',
      },
    },
  },
  argTypes: {
    model: {
      description:
        "The binding's display state: `name`, `sourceText`, `styleText`, `expanded`, " +
        '`styleLabel`, `styleOptions`, `selectedStyleId`, `triggerOptions` and ' +
        '`selectedTriggerId` (or `null` when the style has no trigger), `amount` (or `null` when the style takes none), `secondAmount` (or `null`), ' +
        '`statusText` (or `null`) and the edit and delete accessible names.',
    },
    editToggle: {
      description: 'Emits when the edit button is pressed, to expand or collapse the row.',
    },
    styleSelect: { description: 'Emits the id of the style (or Action) the user chose.' },
    triggerSelect: { description: 'Emits the id of the trigger the user chose.' },
    amountChange: {
      description:
        "Emits a new amount, only for a finite value within the amount's `min` and `max`.",
    },
    secondAmountChange: {
      description: 'Emits a new second amount, only for a finite value within its `min` and `max`.',
    },
    relearn: { description: 'Emits when Re-learn source is pressed.' },
    deleteBinding: { description: 'Emits when either delete control is pressed.' },
  },
};

export default meta;
type Story = StoryObj<BindingRowComponent>;

const ccStyleOptions = [
  { id: 'absolute', label: 'Absolute' },
  { id: 'relative-offset', label: 'Relative (binary offset)' },
  { id: 'relative-signed', label: "Relative (two's complement)" },
  { id: 'step', label: 'Step' },
];

const actionOptions = [
  { id: 'toggle', label: 'Toggle' },
  { id: 'on', label: 'Turn on' },
  { id: 'off', label: 'Turn off' },
];

const noteTriggerOptions = [
  { id: 'press', label: 'Note On' },
  { id: 'release', label: 'Note Off' },
];

const relativeAmount: BindingRowAmount = {
  label: 'Sensitivity',
  value: 1,
  min: 0.1,
  max: 10,
  step: 0.1,
  suffix: '%',
};

const stepAmount: BindingRowAmount = {
  label: 'Amount',
  value: 5,
  min: -100,
  max: 100,
  step: 0.1,
  suffix: '%',
};

const handReach: BindingRowAmount = {
  label: 'Reach',
  value: 130,
  min: 20,
  max: 2000,
  step: 10,
  suffix: 'ms',
};

const handGrip: BindingRowAmount = {
  label: 'Grip',
  value: 250,
  min: 50,
  max: 3000,
  step: 10,
  suffix: 'ms',
};

function baseModel(overrides: Partial<BindingRowModel> = {}): BindingRowModel {
  return {
    name: 'Speed',
    sourceText: 'Launch Control XL · ch 1 · CC 21',
    styleText: 'Relative (binary offset) · 1%',
    expanded: false,
    styleLabel: 'Style',
    styleOptions: ccStyleOptions,
    selectedStyleId: 'relative-offset',
    triggerOptions: null,
    selectedTriggerId: null,
    amount: relativeAmount,
    secondAmount: null,
    statusText: null,
    editAccessibleName: 'Edit Speed binding',
    deleteAccessibleName: 'Delete Speed binding',
    ...overrides,
  };
}

export const Collapsed: Story = {
  args: { model: baseModel() },
};

/** A binding whose controller is away: the row dims, and the reason is stated as text. */
export const CollapsedNotConnected: Story = {
  args: { model: baseModel({ statusText: 'Controller not connected' }) },
};

/** A style that takes no amount shows only the Style segmented control. */
export const ExpandedWithoutAmount: Story = {
  args: {
    model: baseModel({
      expanded: true,
      styleText: 'Absolute',
      selectedStyleId: 'absolute',
      amount: null,
    }),
  },
};

/** A CC encoder: Style with the two relative options and no Trigger, plus a Sensitivity. */
export const ExpandedCcEncoder: Story = {
  args: { model: baseModel({ expanded: true }) },
};

/** A note on a value control stepping on Note Off: Action, Trigger and Amount. */
export const ExpandedStepKey: Story = {
  args: {
    model: baseModel({
      expanded: true,
      sourceText: 'Launch Control XL · ch 1 · Note 36',
      styleText: 'Step +5% · Note Off',
      styleLabel: 'Action',
      styleOptions: [{ id: 'step', label: 'Step' }],
      selectedStyleId: 'step',
      triggerOptions: noteTriggerOptions,
      selectedTriggerId: 'release',
      amount: stepAmount,
    }),
  },
};

/** An on/off binding: Action and Trigger. */
export const ExpandedOnOff: Story = {
  args: {
    model: baseModel({
      name: 'Voice 1 mute',
      sourceText: 'Launch Control XL · ch 1 · Note 41',
      styleText: 'Turn off · Note Off',
      expanded: true,
      styleLabel: 'Action',
      styleOptions: actionOptions,
      selectedStyleId: 'off',
      triggerOptions: noteTriggerOptions,
      selectedTriggerId: 'release',
      amount: null,
    }),
  },
};

/** A one-shot button has no Action to choose, so only the Trigger shows. */
export const ExpandedOneShot: Story = {
  args: {
    model: baseModel({
      name: 'Next track',
      sourceText: 'Launch Control XL · ch 1 · Note 42',
      styleText: 'Note On',
      expanded: true,
      styleLabel: 'Action',
      styleOptions: [],
      selectedStyleId: 'fire',
      triggerOptions: noteTriggerOptions,
      selectedTriggerId: 'press',
      amount: null,
    }),
  },
};

/** A CC on a value control offers four styles; the long relative labels wrap rather than being
 *  cut off in the control's equal-width cells. */
export const ExpandedFourStyles: Story = {
  args: { model: baseModel({ expanded: true }) },
};

/** A pitch bend strip as a hand: the single Hand style, then Reach and Grip in milliseconds. Enter
 *  a value outside a field's range to see its own inline error. */
export const ExpandedHand: Story = {
  args: {
    model: baseModel({
      name: 'Seek',
      sourceText: 'Launch Control XL · ch 1 · Pitch bend',
      styleText: 'Hand · reach 130 ms · grip 250 ms',
      expanded: true,
      styleOptions: [{ id: 'hand', label: 'Hand' }],
      selectedStyleId: 'hand',
      amount: handReach,
      secondAmount: handGrip,
    }),
  },
};

/** Interactive: the story owns the model, as a caller would. Expand the row, change the style,
 *  and type an amount — a value outside its range, or no value, shows an inline error and is not
 *  applied. */
export const Interactive: Story = {
  render: () => ({
    props: {
      model: baseModel(),
      toggleExpanded(this: { model: BindingRowModel }) {
        this.model = { ...this.model, expanded: !this.model.expanded };
      },
      chooseStyle(this: { model: BindingRowModel }, id: string) {
        this.model = {
          ...this.model,
          selectedStyleId: id,
          amount: id === 'absolute' ? null : id === 'step' ? stepAmount : relativeAmount,
        };
      },
      applyAmount(this: { model: BindingRowModel }, value: number) {
        if (this.model.amount) {
          this.model = { ...this.model, amount: { ...this.model.amount, value } };
        }
      },
    },
    template: `
      <lib-binding-row
        [model]="model"
        (editToggle)="toggleExpanded()"
        (styleSelect)="chooseStyle($event)"
        (amountChange)="applyAmount($event)"
      />
    `,
  }),
};
