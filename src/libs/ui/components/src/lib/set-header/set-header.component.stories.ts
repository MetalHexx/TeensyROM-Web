import type { Meta, StoryObj } from '@storybook/angular';
import { SetHeaderComponent, type SetHeaderModel } from './set-header.component';

const meta: Meta<SetHeaderComponent> = {
  title: 'DJ/Set Header',
  component: SetHeaderComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The set card’s header: the set’s name renamed in place, the SID count, a Saved lamp that ' +
          'is a polite `role="status"` for assistive tech (lit when saved, pulsing amber while ' +
          'saving — steady under reduced motion — red when the save failed), and the Delete and ' +
          'New keys. Delete opens an inline confirm: focus moves to Cancel, Escape cancels and ' +
          'returns focus to the Delete key, and only the confirm’s Delete key emits `deleteSet`.',
      },
    },
  },
  argTypes: {
    model: { description: 'The header’s state: name, count, save state and every name.' },
    rename: { description: 'The name was committed; carries the new name.' },
    newSet: { description: 'The New key was pressed.' },
    deleteSet: { description: 'The confirm’s Delete key was pressed.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 480px">
        <lib-set-header [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<SetHeaderComponent>;

const base: SetHeaderModel = {
  name: 'Friday warm-up',
  nameMaxLength: 64,
  countText: '8 SIDS',
  save: 'saved',
  saveText: 'Saved',
  renameLabel: 'Rename set Friday warm-up',
  newAccessibleName: 'New set',
  deleteAccessibleName: 'Delete set Friday warm-up',
  deletePrompt: "Delete Friday warm-up? This can't be undone.",
  disabled: false,
};

export const Saved: Story = { args: { model: base } };

/** The lamp pulses amber (steady under reduced motion). */
export const Saving: Story = { args: { model: { ...base, save: 'saving', saveText: 'Saving' } } };

export const Failed: Story = { args: { model: { ...base, save: 'failed', saveText: 'Not saved' } } };

/** Before the library is ready: the name is plain text and the keys are inert. */
export const NotReady: Story = { args: { model: { ...base, disabled: true } } };

/** The inline confirm, opened: focus is on Cancel. */
export const ConfirmingDelete: Story = {
  args: { model: base },
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('[data-part="delete"] button')?.click();
  },
};

export const LongName: Story = {
  args: { model: { ...base, name: 'Friday night warm-up set for the long weekend at the club' } },
};
