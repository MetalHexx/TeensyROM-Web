import type { Meta, StoryObj } from '@storybook/angular';
import { DeckSetRowComponent, type DeckSetRowModel } from './deck-set-row.component';

const meta: Meta<DeckSetRowComponent> = {
  title: 'DJ/Deck Set Row',
  component: DeckSetRowComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The row under a deck’s transport keys that walks the deck through the set: a previous ' +
          'key, a `SET` readout of the deck’s position and the set’s name (ellipsised), and a ' +
          'next key. The keys’ labels hide when `--synth-key-label-display: none` is set on the ' +
          'host, as the transport does as it narrows.',
      },
    },
  },
  argTypes: {
    model: { description: 'The row’s state: position, set name, disabled flags and names.' },
    previous: { description: 'The previous key was pressed.' },
    next: { description: 'The next key was pressed.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 400px">
        <lib-deck-set-row [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<DeckSetRowComponent>;

const base: DeckSetRowModel = {
  positionText: '02/08',
  setName: 'Friday warm-up',
  previousDisabled: false,
  nextDisabled: false,
  previousAccessibleName: 'Previous in the set deck A',
  nextAccessibleName: 'Next in the set deck A',
};

export const Middle: Story = { args: { model: base } };

export const FirstRow: Story = {
  args: { model: { ...base, positionText: '01/08', previousDisabled: true } },
};

export const LastRow: Story = {
  args: { model: { ...base, positionText: '08/08', nextDisabled: true } },
};

export const NoSet: Story = {
  args: {
    model: { ...base, positionText: '— / —', setName: '', previousDisabled: true, nextDisabled: true },
  },
};

export const LongName: Story = {
  args: { model: { ...base, setName: 'Friday night warm-up set for the long weekend at the club' } },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 300px">
        <lib-deck-set-row [model]="model" />
      </div>
    `,
  }),
};
