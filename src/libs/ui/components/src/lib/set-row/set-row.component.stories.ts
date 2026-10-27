import type { Meta, StoryObj } from '@storybook/angular';
import { SetRowComponent, type SetRowModel } from './set-row.component';

const meta: Meta<SetRowComponent> = {
  title: 'DJ/Set Row',
  component: SetRowComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One tune in the set card: a drag handle (focusable, where Alt+ArrowUp and Alt+ArrowDown ' +
          'move the row), its number, title and author, a detail line, the A and B deck lights, its ' +
          'length and a remove key. The detail is the loop and cue counts, an indeterminate bar ' +
          'while the tune is fetched or analysed, or the reason it is unavailable in the dimmed ' +
          'warning colour. The selected row carries `aria-current` and the knob’s highlight; a ' +
          'pending row has no handle or remove key and cannot be selected.',
      },
    },
  },
  argTypes: {
    model: { description: 'The row’s state, with every accessible name.' },
    selectRow: { description: 'The row was pressed.' },
    remove: { description: 'The remove key was pressed.' },
    moveBy: { description: 'Alt+ArrowUp (-1) or Alt+ArrowDown (1) was pressed on the handle.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 480px">
        <lib-set-row [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<SetRowComponent>;

const base: SetRowModel = {
  id: 'row-3',
  numberText: '03',
  title: 'Cybernoid II',
  author: 'Jeroen Tel',
  detail: { kind: 'counts', text: '4 loops · 2 cues' },
  lengthText: '03:58',
  decks: [],
  selected: false,
  pending: false,
  accessibleName: 'Row 3 of 8, Cybernoid II by Jeroen Tel, 4 loops, 2 cues, 03:58',
  handleAccessibleName: 'Move Cybernoid II, Alt and arrow keys move it',
  removeAccessibleName: 'Remove Cybernoid II from the set',
};

export const Counts: Story = { args: { model: base } };

export const NoLoops: Story = { args: { model: { ...base, detail: { kind: 'counts', text: 'No loops' } } } };

/** The knob’s selection: highlighted, and `aria-current`. */
export const Selected: Story = { args: { model: { ...base, selected: true } } };

/** On deck A, playing, and on deck B, paused. */
export const OnBothDecks: Story = {
  args: {
    model: {
      ...base,
      selected: true,
      decks: [
        { letter: 'A', light: 'playing' },
        { letter: 'B', light: 'paused' },
      ],
    },
  },
};

export const Fetching: Story = {
  args: { model: { ...base, pending: true, detail: { kind: 'fetching' }, lengthText: '—' } },
};

export const Analyzing: Story = {
  args: { model: { ...base, pending: true, detail: { kind: 'analyzing' }, lengthText: '—' } },
};

export const Unavailable: Story = {
  args: {
    model: { ...base, detail: { kind: 'unavailable', text: 'Not on this device' }, lengthText: '—' },
  },
};

export const LongTitle: Story = {
  args: {
    model: {
      ...base,
      title: 'Last Ninja 2 - The Wilderness (Extended Remix With A Very Long Name)',
      author: 'Ben Daglish and the Ocean Software Sound Team',
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 320px">
        <lib-set-row [model]="model" />
      </div>
    `,
  }),
};
