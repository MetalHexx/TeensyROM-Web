import type { Meta, StoryObj } from '@storybook/angular';
import { DeckLabelComponent } from './deck-label.component';

const meta: Meta<DeckLabelComponent> = {
  title: 'DJ/Deck Label',
  component: DeckLabelComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A deck's heading on the SID panel: bold, widely spaced uppercase text beside a short " +
          'glowing magenta accent bar. `accentSide` `end` mirrors the bar to the far side, which ' +
          'is how deck B is drawn.',
      },
    },
  },
  argTypes: {
    label: { description: "The heading text, e.g. 'Deck A'; drawn in uppercase." },
    accentSide: {
      description: 'Which side of the text the accent bar sits on.',
      control: 'inline-radio',
      options: ['start', 'end'],
    },
  },
};

export default meta;
type Story = StoryObj<DeckLabelComponent>;

export const Default: Story = {
  args: { label: 'Deck A', accentSide: 'start' },
  render: (args) => ({
    props: args,
    template: `<lib-deck-label [label]="label" [accentSide]="accentSide" />`,
  }),
};

export const AccentAtEnd: Story = {
  args: { label: 'Deck B', accentSide: 'end' },
  render: Default.render,
};
