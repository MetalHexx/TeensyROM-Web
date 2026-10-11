import { MatCardModule } from '@angular/material/card';
import { componentWrapperDecorator, moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLabelComponent } from '../icon-label/icon-label.component';
import { ScalingCardComponent } from '../scaling-card/scaling-card.component';
import { InlineEditTitleComponent } from './inline-edit-title.component';

const notBlank = (draft: string) => draft.trim().length > 0;

const openField = (canvasElement: HTMLElement): HTMLInputElement => {
  canvasElement.querySelector<HTMLButtonElement>('button.title')?.click();
  return canvasElement.querySelector('input') as HTMLInputElement;
};

const meta: Meta<InlineEditTitleComponent> = {
  title: 'Primitives/Inline Edit Title',
  component: InlineEditTitleComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [MatCardModule, ScalingCardComponent, IconButtonComponent, IconLabelComponent],
    }),
    componentWrapperDecorator(
      (story) =>
        `<div style="width: 320px; font-size: 22px; line-height: 28px; color: var(--mat-sys-on-surface, #fff)">${story}</div>`
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "A title that renames itself in place. At rest it is a button showing `value` with a pencil revealed on hover and keyboard focus; clicking it or pressing Enter swaps in a text field laid over the same line box, so nothing around it moves between the resting, editing, invalid and saving states. It inherits font, line height, letter spacing and colour from its container — place it inside whatever already styles the title, such as a `mat-card-title` projected into a card's `header` slot. The component knows nothing about the rules behind the name: the consumer passes `isValid` and `maxLength`, listens for `commit`, persists the new text, and feeds it back through `value`. Enter commits (an invalid draft keeps the field open and turns the outline and counter red), Escape cancels, and leaving the field commits a valid changed draft and otherwise reverts. After a commit the field stays open, disabled and showing the typed text until `saving` returns to false; the button then shows `value` — the new name on success, the old one on failure. Reach for `InputFieldComponent` instead when the text is a form field rather than a heading.",
      },
    },
  },
  argTypes: {
    value: {
      description: 'The committed text shown at rest and the baseline an edit is compared against.',
      control: 'text',
    },
    maxLength: {
      description:
        'Maximum characters the field accepts, and the denominator of the `n/max` counter.',
      control: 'number',
    },
    isValid: {
      description:
        "The consumer's rule for a committable draft; receives the raw (untrimmed) draft. Defaults to accepting anything.",
      control: false,
    },
    saving: {
      description:
        'Keeps the field open and disabled while the consumer persists a committed change; raise it from the commit handler and lower it when the save settles.',
      control: 'boolean',
    },
    editLabel: {
      description: 'Accessible name for the title button and the text field, e.g. "Rename TR-1".',
      control: 'text',
    },
    invalidDescription: {
      description:
        'Visually hidden explanation linked with `aria-describedby` and announced while the draft is flagged invalid.',
      control: 'text',
    },
    commit: {
      description:
        'Emits the trimmed draft when a valid draft that differs from `value` is committed.',
      action: 'commit',
    },
  },
  args: {
    value: 'TR-1',
    maxLength: 24,
    isValid: notBlank,
    saving: false,
    editLabel: 'Rename TR-1',
    invalidDescription: 'Name must be 1-24 characters.',
  },
};

export default meta;
type Story = StoryObj<InlineEditTitleComponent>;

/** Resting state: the value as a button; hover or focus it to reveal the pencil. */
export const View: Story = {};

/** Edit mode with the current text selected and the `n/max` counter at the field's right end. */
export const Editing: Story = {
  play: async ({ canvasElement }) => {
    openField(canvasElement);
  },
};

/** An Enter on a draft the consumer's `isValid` rejects keeps the field open with a red outline and counter. */
export const Invalid: Story = {
  play: async ({ canvasElement }) => {
    const input = openField(canvasElement);
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  },
};

/** The field is disabled whenever `saving` is true. */
export const Disabled: Story = {
  args: { saving: true },
  play: async ({ canvasElement }) => {
    openField(canvasElement);
  },
};

/** The consumer's round trip: commit, the field stays open and disabled for a short save, then the new `value` is fed back. */
export const Saving: Story = {
  render: (args) => ({
    props: {
      ...args,
      saving: false,
      onCommit(this: { value: string; saving: boolean }, next: string) {
        this.saving = true;
        setTimeout(() => {
          this.value = next;
          this.saving = false;
        }, 1200);
      },
    },
    template: `
      <lib-inline-edit-title
        [value]="value"
        [maxLength]="maxLength"
        [isValid]="isValid"
        [saving]="saving"
        [editLabel]="editLabel"
        [invalidDescription]="invalidDescription"
        (commit)="onCommit($event)"
      />
    `,
  }),
};

/** The intended composition: a `mat-card-title` in the card's `header` slot, so Material keeps owning the title typography. */
export const InCard: Story = {
  decorators: [componentWrapperDecorator((story) => `<div style="width: 360px">${story}</div>`)],
  render: (args) => ({
    props: args,
    template: `
      <lib-scaling-card [enableOverflow]="false">
        <lib-icon-button slot="corner" icon="power_settings_new" ariaLabel="Toggle Enabled" size="medium"></lib-icon-button>
        <mat-card-title slot="header">
          <lib-inline-edit-title
            [value]="value"
            [maxLength]="maxLength"
            [isValid]="isValid"
            [saving]="saving"
            [editLabel]="editLabel"
            [invalidDescription]="invalidDescription"
            (commit)="commit($event)"
          />
        </mat-card-title>
        <lib-icon-label icon="tag" label="Device ID: demo"></lib-icon-label>
        <lib-icon-label icon="developer_board" label="Firmware: 1.0.0"></lib-icon-label>
      </lib-scaling-card>
    `,
  }),
};
