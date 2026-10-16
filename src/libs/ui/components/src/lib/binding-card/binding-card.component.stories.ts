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
          "One deck's own MIDI binding: its selector of options — cartridges, or output ports — " +
          'Enable MIDI beside Identify, and whichever of its three distinct error states apply. ' +
          'Purely presentational — it holds no state of its own; the caller owns the permission ' +
          "grant, the option list and this deck's own persisted selection. " +
          '`layout="inline"` lays the heading, the control and the two buttons on one row ' +
          'instead of the default `"stacked"` column.',
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

/** Nothing to choose from: the select shows its single disabled placeholder, Identify is out of
 *  reach, and the Enable MIDI button is showing. */
export const NotEnabled: Story = {
  args: { model: bindingModel() },
};

/** Granted: the origin auto-connected on its own, so the Enable MIDI button is hidden entirely —
 *  there is nothing left for it to do. */
export const Granted: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      ports: [{ id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' }],
      selectedPortId: '14470230',
      identifyDisabled: false,
    }),
  },
};

/** Granted, with a cartridge list to choose from and one already selected. */
export const GrantedWithPorts: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      ports: [
        { id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' },
        { id: '19277260', label: 'TR-2: TeensyROM-19277260 (Microsoft Corporation)' },
      ],
      selectedPortId: '14470230',
      identifyDisabled: false,
    }),
  },
};

/** The bound cartridge is not plugged in: it stays selected, its label says `· absent` in text,
 *  the select is drawn in the error colour, and Identify is out of reach. */
export const Absent: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      ports: [
        { id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' },
        { id: '19277260', label: 'TR-2: TeensyROM-19277260 · absent', absent: true },
      ],
      selectedPortId: '19277260',
      identifyDisabled: true,
    }),
  },
};

/** Granted, but Web MIDI enumerated no output ports — no cartridge attached, or the OS has not
 *  surfaced it yet. */
export const GrantedNoPortsFound: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      errors: [
        'MIDI access was granted, but no output ports were found. Connect the cartridge — it appears here as soon as the browser sees it.',
      ],
    }),
  },
};

/** Another deck already holds the cartridge this one just tried to claim. */
export const BindingError: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      ports: [{ id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' }],
      errors: ['Deck B is already bound to that cartridge.'],
    }),
  },
};

/** `layout="inline"`: heading, cartridge control and the two buttons share one row instead of
 *  stacking, for a host with less vertical room to give. */
export const Inline: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      ports: [
        { id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' },
        { id: '19277260', label: 'TR-2: TeensyROM-19277260 (Microsoft Corporation)' },
      ],
      selectedPortId: '14470230',
      identifyDisabled: false,
    }),
    layout: 'inline',
  },
};

/** `layout="inline"`, nothing bound yet: the select shows its own placeholder. */
export const Unbound: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      ports: [
        { id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' },
        { id: '19277260', label: 'TR-2: TeensyROM-19277260 (Microsoft Corporation)' },
      ],
    }),
    layout: 'inline',
  },
};

/** `layout="inline"`, a cartridge already selected. */
export const Bound: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      ports: [
        { id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' },
        { id: '19277260', label: 'TR-2: TeensyROM-19277260 (Microsoft Corporation)' },
      ],
      selectedPortId: '14470230',
      identifyDisabled: false,
    }),
    layout: 'inline',
  },
};

/** `layout="inline"`, Deck B already holds one cartridge — the taken option renders the deck
 *  letter as text, never colour alone, and is disabled. */
export const Taken: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: false,
      ports: [
        { id: '14470230', label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' },
        {
          id: '19277260',
          label: 'TR-2: TeensyROM-19277260 (Microsoft Corporation)',
          takenBy: 'B',
        },
      ],
    }),
    layout: 'inline',
  },
};

/** `layout="inline"`, before the Enable gesture with a bound cartridge not yet seen on a MIDI port
 *  — it still reads as the selection, flagged absent in text. */
export const AbsentInline: Story = {
  args: {
    model: bindingModel({
      portsEnabled: true,
      portPlaceholder: '— select a cartridge —',
      enableVisible: true,
      ports: [{ id: '19277260', label: 'TR-2: TeensyROM-19277260 · absent', absent: true }],
      selectedPortId: '19277260',
    }),
    layout: 'inline',
  },
};
