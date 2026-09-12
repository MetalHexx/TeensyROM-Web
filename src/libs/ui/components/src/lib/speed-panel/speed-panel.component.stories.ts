import type { Meta, StoryObj } from '@storybook/angular';
import { SpeedPanelComponent, SpeedPanelModel } from './speed-panel.component';

const meta: Meta<SpeedPanelComponent> = {
  title: 'DJ/Speed Panel',
  component: SpeedPanelComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's speed control: a readout, a vertical fader and a jump button group. Purely " +
          'presentational — it holds no state of its own; the caller has already pinned ' +
          '`faderValue` into `[min, max]` and formatted `valueText`.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<SpeedPanelComponent>;

const model: SpeedPanelModel = {
  accessibleName: 'Speed deck A',
  valueText: '1.000x',
  faderValue: 1,
  faderAccessibleName: 'Speed multiplier deck A',
  min: 0.5,
  max: 1.5,
  step: 0.001,
  jumpButtons: [
    { id: 'up', label: '+50%', accessibleName: 'Speed up 50% deck A' },
    { id: 'home', label: 'Home', accessibleName: 'Speed home deck A' },
    { id: 'down', label: '−50%', accessibleName: 'Speed down 50% deck A' },
  ],
};

export const Default: Story = {
  args: { model },
};
