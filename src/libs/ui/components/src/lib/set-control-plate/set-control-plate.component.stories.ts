import type { Meta, StoryObj } from '@storybook/angular';
import { SetControlPlateComponent, type SetControlPlateModel } from './set-control-plate.component';

const meta: Meta<SetControlPlateComponent> = {
  title: 'DJ/Set Control Plate',
  component: SetControlPlateComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The set’s controls on a plate: the Select group — an up key, a readout of the selected ' +
          'row (`SEL`, its position, its title and author) and a down key — and the Load A and ' +
          'Load B keys. All are one-shot keys, and the plate only reports presses.',
      },
    },
  },
  argTypes: {
    model: { description: 'The plate’s state: the selection’s readout, disabled flags and names.' },
    selectPrevious: { description: 'The Select up key was pressed.' },
    selectNext: { description: 'The Select down key was pressed.' },
    loadA: { description: 'Load A was pressed.' },
    loadB: { description: 'Load B was pressed.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 480px">
        <lib-set-control-plate [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<SetControlPlateComponent>;

const base: SetControlPlateModel = {
  positionText: '03/08',
  title: 'Cybernoid II',
  author: 'Jeroen Tel',
  previousDisabled: false,
  nextDisabled: false,
  loadDisabled: false,
  selectAccessibleName: 'Set selection, 3 of 8, Cybernoid II by Jeroen Tel',
  previousAccessibleName: 'Select the previous row',
  nextAccessibleName: 'Select the next row',
  loadAAccessibleName: 'Load Cybernoid II on deck A',
  loadBAccessibleName: 'Load Cybernoid II on deck B',
};

export const Selected: Story = { args: { model: base } };

export const FirstRow: Story = {
  args: { model: { ...base, positionText: '01/08', previousDisabled: true } },
};

export const NothingSelected: Story = {
  args: {
    model: {
      ...base,
      positionText: '— / —',
      title: null,
      author: null,
      previousDisabled: true,
      nextDisabled: true,
      loadDisabled: true,
      selectAccessibleName: 'Set selection, nothing selected',
    },
  },
};

export const Narrow: Story = {
  args: {
    model: { ...base, title: 'Last Ninja 2 - The Wilderness (Extended Remix)', author: 'Ben Daglish' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 300px">
        <lib-set-control-plate [model]="model" />
      </div>
    `,
  }),
};
