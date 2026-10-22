import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { DeckLabelComponent } from '../deck-label/deck-label.component';
import { PanelSectionComponent } from '../panel-section/panel-section.component';
import { PanicButtonComponent } from '../panic-button/panic-button.component';
import { SynthPanelComponent } from './synth-panel.component';

const meta: Meta<SynthPanelComponent> = {
  title: 'DJ/Synth Panel',
  component: SynthPanelComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({ imports: [DeckLabelComponent, PanelSectionComponent, PanicButtonComponent] }),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The SID panel's faceplate: a dark, lightly lit board with a hairline border and a " +
          'screw in each corner. It only frames what is projected into it; the consumer owns ' +
          'the inner layout.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<SynthPanelComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <lib-synth-panel style="width: 520px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <lib-deck-label label="Deck A" />
          <lib-panic-button accessibleName="Panic: silence all voices" />
        </div>
        <lib-panel-section title="Voice 1"><div style="height: 60px;"></div></lib-panel-section>
      </lib-synth-panel>
    `,
  }),
};
