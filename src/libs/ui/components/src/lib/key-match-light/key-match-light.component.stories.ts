import type { Meta, StoryObj } from '@storybook/angular';
import { KeyMatchLightComponent } from './key-match-light.component';

const meta: Meta<KeyMatchLightComponent> = {
  title: 'DJ/Key Match Light',
  component: KeyMatchLightComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A single LED showing how well the two decks' keys match: green for a full match, " +
          'softer green for close, amber for possible, red for a clash, and unlit when a deck ' +
          'has no key.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<KeyMatchLightComponent>;

export const Full: Story = { args: { state: 'full' } };

export const Close: Story = { args: { state: 'close' } };

export const Possible: Story = { args: { state: 'possible' } };

export const Clash: Story = { args: { state: 'clash' } };

export const NoKey: Story = { args: { state: 'none' } };
