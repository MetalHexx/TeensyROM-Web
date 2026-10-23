import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { RotaryKnobComponent } from '../rotary-knob/rotary-knob.component';
import { PanelSectionComponent } from './panel-section.component';

const meta: Meta<PanelSectionComponent> = {
  title: 'DJ/Panel Section',
  component: PanelSectionComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [RotaryKnobComponent] })],
  parameters: {
    docs: {
      description: {
        component:
          'A titled group on the SID panel: a hairline frame with the title centred in its top ' +
          'edge. A native fieldset and legend, so assistive technology announces the title as ' +
          "the group's name. It does not lay out its content; the consumer arranges whatever is " +
          'projected into it.',
      },
    },
  },
  argTypes: {
    title: { description: "The group's title, drawn in uppercase in the frame's top edge." },
  },
};

export default meta;
type Story = StoryObj<PanelSectionComponent>;

export const Default: Story = {
  args: { title: 'Filter' },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 260px; padding: 8px; background: var(--synth-face);">
        <lib-panel-section [title]="title">
          <div style="display: flex; justify-content: space-around;">
            <lib-rotary-knob label="Cutoff" accessibleName="Cutoff" [value]="0.4" [min]="0" [max]="1" [home]="0" appearance="panel" />
            <lib-rotary-knob label="Res" accessibleName="Resonance" [value]="0.2" [min]="0" [max]="1" [home]="0" appearance="panel" />
          </div>
        </lib-panel-section>
      </div>
    `,
  }),
};

export const Empty: Story = {
  args: { title: 'Voice 1' },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 260px; padding: 8px; background: var(--synth-face);">
        <lib-panel-section [title]="title"><div style="height: 40px;"></div></lib-panel-section>
      </div>
    `,
  }),
};
