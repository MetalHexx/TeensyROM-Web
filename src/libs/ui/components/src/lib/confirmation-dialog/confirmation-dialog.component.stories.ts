import type { Meta, StoryObj } from '@storybook/angular';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';

const meta: Meta<ConfirmationDialogComponent> = {
  title: 'Overlay & Interaction/Confirmation Dialog',
  component: ConfirmationDialogComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ConfirmationDialogComponent>;

/**
 * `lib-confirmation-dialog` is a plain presentational component with no internal
 * show/hide state, so an args-only story already renders it "open" by default. This is
 * the default icon-only button pair (`showLabels: false`).
 */
export const Default: Story = {
  args: {
    title: 'Delete Preset',
    message: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    confirmIcon: 'delete',
    cancelIcon: 'close',
    showLabels: false,
  },
};

/**
 * Recently-added visual mode: two labelled `lib-action-button` actions instead of the
 * default icon-only button pair.
 */
export const LabelledButtons: Story = {
  args: {
    ...Default.args,
    showLabels: true,
  },
};
