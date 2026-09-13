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
          '`faderValue` into `[min, max]` and formatted `valueText`. The host is itself a flex ' +
          "column, so the fader's own `flex: 1 1 0` fills whatever height a bounded ancestor gives " +
          "this component — see the `BoundedColumn` story.",
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

/** Rendered inside a fixed-height flex column (360px), the state the shell failed to reach: the
 *  fader fills the height between the readout and the jump buttons instead of collapsing to its
 *  own content size. */
export const BoundedColumn: Story = {
  render: () => ({
    props: { model },
    template: `
      <div style="display: flex; flex-direction: column; height: 360px;">
        <lib-speed-panel [model]="model" />
      </div>
    `,
  }),
};
