import type { Meta, StoryObj } from '@storybook/angular';
import { BindingPlateComponent } from './binding-plate.component';
import type { BindingCardModel } from '../binding-card/binding-card.component';

const meta: Meta<BindingPlateComponent> = {
  title: 'DJ/Binding Plate',
  component: BindingPlateComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's MIDI binding on a faceplate row: the deck's label, its selector, Identify, " +
          'and Enable MIDI while it is still offered. The row fits a deck column of about 248px, ' +
          'the select taking the slack. Purely presentational — the caller owns the permission ' +
          "grant, the option list and this deck's own persisted selection.",
      },
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 248px">
        <lib-binding-plate [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<BindingPlateComponent>;

function bindingModel(overrides: Partial<BindingCardModel> = {}): BindingCardModel {
  return {
    accessibleName: 'MIDI binding deck A',
    heading: 'Deck A',
    ports: [],
    selectedPortId: null,
    portsEnabled: false,
    portPlaceholder: '— select a cartridge —',
    enableVisible: true,
    enableDisabled: false,
    identifyDisabled: true,
    selectAccessibleName: 'Cartridge deck A',
    enableAccessibleName: 'Enable MIDI deck A',
    identifyAccessibleName: 'Identify deck A',
    errors: [],
    ...overrides,
  };
}

/** Before MIDI is enabled: the select shows its single disabled placeholder, Identify is out of
 *  reach, and the Enable MIDI key is showing. */
export const BeforeMidiEnabled: Story = {
  args: { model: bindingModel() },
};

/** Device present: the cartridge is granted and selected, and Identify is in reach. The Enable
 *  MIDI key is hidden — the origin auto-connected on its own. */
export const DevicePresent: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      enableVisible: false,
      ports: [{ id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' }],
      selectedPortId: '14470230',
      identifyDisabled: false,
    }),
  },
};

/** Device absent: the bound cartridge is not plugged in. It stays selected, its label says
 *  `· absent` in text, the select is drawn in the error colour, and Identify is out of reach. */
export const DeviceAbsent: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      enableVisible: false,
      ports: [{ id: '19277260', label: 'TR-2: TeensyROM-19277260 · absent', absent: true }],
      selectedPortId: '19277260',
      identifyDisabled: true,
    }),
  },
};

/** Enable in flight: the permission grant is pending, so the Enable MIDI key is dimmed. */
export const EnableInFlight: Story = {
  args: {
    model: bindingModel({
      enableDisabled: true,
    }),
  },
};

/** An error: another deck already holds the cartridge this one just tried to claim. */
export const BindingError: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      enableVisible: false,
      ports: [{ id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' }],
      errors: ['Deck B is already bound to that cartridge.'],
    }),
  },
};
