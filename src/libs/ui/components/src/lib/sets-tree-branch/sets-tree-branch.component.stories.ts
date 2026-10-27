import type { Meta, StoryObj } from '@storybook/angular';
import { SetsTreeBranchComponent, type SetsTreeBranchModel } from './sets-tree-branch.component';

const meta: Meta<SetsTreeBranchComponent> = {
  title: 'DJ/Sets Tree Branch',
  component: SetsTreeBranchComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The Sets branch of the DJ browse tree: a branch row with a chevron and `aria-expanded` ' +
          'over a group of saved sets, drawn like the rest of the tree. The set the view has loaded ' +
          'is `aria-selected` and lit. Click, Enter and Space activate a row.',
      },
    },
  },
  argTypes: {
    model: { description: 'The branch’s label and sets.' },
    expanded: { description: 'Whether the set rows are showing. Defaults to true.' },
    expandedChange: { description: 'The branch row was activated; carries the new state.' },
    setSelect: { description: 'A set row was activated; carries the set’s id.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div role="tree" style="width: 280px">
        <lib-sets-tree-branch [model]="model" [expanded]="expanded" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<SetsTreeBranchComponent>;

const model: SetsTreeBranchModel = {
  label: 'Sets',
  sets: [
    { id: 's1', name: 'Friday warm-up', loaded: false, accessibleName: 'Set Friday warm-up' },
    { id: 's2', name: 'Hubbard only', loaded: false, accessibleName: 'Set Hubbard only' },
    { id: 's3', name: 'Closing set', loaded: false, accessibleName: 'Set Closing set' },
  ],
};

export const Expanded: Story = { args: { model, expanded: true } };

export const Collapsed: Story = { args: { model, expanded: false } };

/** The loaded set is selected and carries a light. */
export const WithALoadedSet: Story = {
  args: {
    model: {
      ...model,
      sets: model.sets.map((set) =>
        set.id === 's2' ? { ...set, loaded: true, accessibleName: 'Set Hubbard only, loaded' } : set
      ),
    },
    expanded: true,
  },
};

export const NoSets: Story = { args: { model: { ...model, sets: [] }, expanded: true } };
