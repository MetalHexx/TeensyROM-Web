import { componentWrapperDecorator } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { ControllerRowComponent, ControllerRowModel } from './controller-row.component';

const meta: Meta<ControllerRowComponent> = {
  title: 'DJ/Controller Row',
  component: ControllerRowComponent,
  tags: ['autodocs'],
  decorators: [
    componentWrapperDecorator(
      (story) =>
        `<div style="width: 340px; padding: 12px; border-radius: 10px; background: #231e22; color: #e9e0e4;">${story}</div>`
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'One MIDI controller in a list: its name, its status as text, a `mat-slide-toggle` — ' +
          'the house switch, as in the settings view — for whether the app listens to it, and, ' +
          'while its port is unknown, a labelled select to choose one. The status is always ' +
          'text — Listening, Off, No mappings, Not connected, In use by another application, or ' +
          'Choose its port — so it never rests on colour alone. Purely presentational: the ' +
          'caller owns the model and updates it from the outputs.',
      },
    },
  },
  argTypes: {
    model: {
      description:
        "The controller's display state: `name`, `statusText`, `listening`, " +
        '`toggleAccessibleName` and `portChoice` (the port picker, or `null`).',
    },
    listeningChange: {
      description: "Emits the switch's new position when the user flips it.",
    },
    portSelect: { description: 'Emits the id of the port the user chose.' },
  },
};

export default meta;
type Story = StoryObj<ControllerRowComponent>;

function baseModel(overrides: Partial<ControllerRowModel> = {}): ControllerRowModel {
  return {
    name: 'Launch Control XL',
    statusText: 'Listening',
    listening: true,
    toggleAccessibleName: 'Listen to Launch Control XL',
    portChoice: null,
    ...overrides,
  };
}

export const Listening: Story = {
  args: { model: baseModel() },
};

export const Off: Story = {
  args: { model: baseModel({ listening: false, statusText: 'Off' }) },
};

/** On, but nothing is mapped to it yet. */
export const NoMappings: Story = {
  args: { model: baseModel({ statusText: 'No mappings' }) },
};

/** The controller is mapped but its hardware is away. */
export const NotConnected: Story = {
  args: { model: baseModel({ statusText: 'Not connected' }) },
};

export const InUseByAnotherApplication: Story = {
  args: { model: baseModel({ statusText: 'In use by another application' }) },
};

/** The port is unknown, so a labelled select offers the candidates. */
export const ChoosePort: Story = {
  args: {
    model: baseModel({
      statusText: 'Choose its port',
      portChoice: {
        accessibleName: 'Port for Launch Control XL',
        options: [
          { id: 'in-1', label: 'Launch Control XL' },
          { id: 'in-2', label: 'MIDIIN2 (Launch Control XL)' },
        ],
      },
    }),
  },
};

/** Interactive: the story owns the model, as a caller would. */
export const Interactive: Story = {
  render: () => ({
    props: {
      model: baseModel(),
      onListeningChange(this: { model: ControllerRowModel }, listening: boolean) {
        this.model = { ...this.model, listening, statusText: listening ? 'Listening' : 'Off' };
      },
    },
    template: `<lib-controller-row [model]="model" (listeningChange)="onListeningChange($event)" />`,
  }),
};
