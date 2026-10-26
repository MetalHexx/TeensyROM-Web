import type { Meta, StoryObj } from '@storybook/angular';
import { DeckSettingsSignComponent } from './deck-settings-sign.component';

const meta: Meta<DeckSettingsSignComponent> = {
  title: 'DJ/Deck Settings Sign',
  component: DeckSettingsSignComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A small inset sign naming whose mixer settings are in play on a deck: a dot and uppercase " +
          'monospaced text, dim for the main track and lit cyan when a marker keeps its own ' +
          'settings. The visible text is read by assistive tech and `accessibleName` labels the ' +
          'sign. The host carries `data-own` while lit. It never animates, and it holds no rule: ' +
          'the caller supplies the text, the lit state and the name.',
      },
    },
  },
  argTypes: {
    model: { description: "The sign's text, whether a marker's own settings are in play, and its accessible name." },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 88px">
        <lib-deck-settings-sign [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<DeckSettingsSignComponent>;

/** The main track's settings are in play: dim. */
export const Main: Story = {
  args: { model: { text: 'Main', own: false, accessibleName: 'Settings in play deck A: Main' } },
};

/** A marker's own settings are in play: lit cyan, named after the marker. */
export const Marker: Story = {
  args: { model: { text: 'Item 2', own: true, accessibleName: 'Settings in play deck A: Item 2' } },
};
