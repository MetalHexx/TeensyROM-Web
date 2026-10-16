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
          'and offers the style as a segmented control, the amount where the style takes one, and ' +
          'Re-learn source and Delete. The amount is a native number input that emits on `change` ' +
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
        '`styleOptions`, `selectedStyleId`, `amount` (or `null` when the style takes none), ' +
        '`statusText` (or `null`) and the edit and delete accessible names.',
    },
    editToggle: {
      description: 'Emits when the edit button is pressed, to expand or collapse the row.',
    },
    styleSelect: { description: 'Emits the id of the style the user chose.' },
    amountChange: {
      description:
        "Emits a new amount, only for a finite value within the amount's `min` and `max`.",
    },
    relearn: { description: 'Emits when Re-learn source is pressed.' },
    deleteBinding: { description: 'Emits when either delete control is pressed.' },
  },
};

export default meta;
type Story = StoryObj<BindingRowComponent>;

const styleOptions = [
  { id: 'absolute', label: 'Absolute' },
  { id: 'relative', label: 'Relative' },
  { id: 'step', label: 'Step' },
];

const relativeAmount: BindingRowAmount = {
  label: 'Amount',
  value: 1,
  min: 0.1,
  max: 10,
  step: 0.1,
  suffix: '%',
};

const stepAmount: BindingRowAmount = {
  label: 'Steps',
  value: 5,
  min: 1,
  max: 32,
  step: 1,
  suffix: 'steps',
};

function baseModel(overrides: Partial<BindingRowModel> = {}): BindingRowModel {
  return {
    name: 'Speed',
    sourceText: 'Launch Control XL · ch 1 · CC 21',
    styleText: 'Relative · 1%',
    expanded: false,
    styleOptions,
    selectedStyleId: 'relative',
    amount: relativeAmount,
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

/** A fractional amount: a relative style's step size. */
export const ExpandedRelativeAmount: Story = {
  args: { model: baseModel({ expanded: true }) },
};

/** A whole-number amount: how many steps a step style takes. */
export const ExpandedStepAmount: Story = {
  args: {
    model: baseModel({
      expanded: true,
      styleText: 'Step · 5 steps',
      selectedStyleId: 'step',
      amount: stepAmount,
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
