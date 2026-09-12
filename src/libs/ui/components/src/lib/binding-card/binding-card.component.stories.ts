import type { Meta, StoryObj } from '@storybook/angular';
import { BindingCardComponent, type BindingCardModel } from './binding-card.component';

const meta: Meta<BindingCardComponent> = {
  title: 'DJ/Binding Card',
  component: BindingCardComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's own MIDI binding: its Output port selector, Enable MIDI beside Identify, " +
          'and whichever of its three distinct error states apply. Purely presentational — it ' +
          'holds no state of its own; the caller owns the permission grant, the enumerated port ' +
          "list and this deck's own persisted selection.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<BindingCardComponent>;

function bindingModel(overrides: Partial<BindingCardModel> = {}): BindingCardModel {
  return {
    accessibleName: 'MIDI binding deck A',
    heading: 'Deck A',
    ports: [],
    selectedPortId: null,
    portsEnabled: false,
    enableDisabled: false,
    identifyDisabled: true,
    selectAccessibleName: 'Output port deck A',
    enableAccessibleName: 'Enable MIDI deck A',
    identifyAccessibleName: 'Identify deck A',
    errors: [],
    ...overrides,
  };
}

/** Before the permission grant: the select shows its single disabled placeholder and Identify is
 *  out of reach. */
export const NotEnabled: Story = {
  args: { model: bindingModel() },
};

/** Granted, with a port list to choose from and one already selected. */
export const GrantedWithPorts: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      ports: [
        { id: 'port-1', label: 'TeensyROM (PJRC)' },
        { id: 'port-2', label: 'Cart B (Acme)' },
      ],
      selectedPortId: 'port-1',
      identifyDisabled: false,
    }),
  },
};

/** Granted, but Web MIDI enumerated no output ports — no cartridge attached, or the OS has not
 *  surfaced it yet. */
export const GrantedNoPortsFound: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      errors: [
        'MIDI access was granted, but no output ports were found. Connect the cartridge and re-enable MIDI.',
      ],
    }),
  },
};

/** Another deck already holds the port this one just tried to claim. */
export const BindingError: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      ports: [{ id: 'port-1', label: 'TeensyROM (PJRC)' }],
      errors: ['Deck B is already bound to that port. Pick a different one.'],
    }),
  },
};
