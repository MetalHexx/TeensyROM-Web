import type { Meta, StoryObj } from '@storybook/angular';
import { PresetNameDialogComponent, PresetNameValidationFn } from './preset-name-dialog.component';

const validateName: PresetNameValidationFn = (name, existingNames) => {
  if (name.trim() === '') return 'Name cannot be empty';
  if (existingNames.includes(name.trim())) return 'Name already exists';
  if (name.length > 50) return 'Name too long';
  return '';
};

const meta: Meta<PresetNameDialogComponent> = {
  title: 'Overlay & Interaction/Preset Name Dialog',
  component: PresetNameDialogComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`lib-preset-name-dialog` is a plain presentational text-entry prompt — like ' +
          '`ConfirmationDialogComponent`, it has no internal open/close state or positioning ' +
          'of its own. Project it inside `DropdownDialogComponent`\'s `[dialog-content]` slot ' +
          'to position it near the trigger that opened it, and call the wrapper\'s `.close()` ' +
          'from `confirmed`/`cancelled`. Validation is entirely caller-driven: pass a ' +
          '`validationFn` that checks the current name against `reservedNames` (or any other ' +
          'rule) and returns an error string, or `\'\'` when the name is acceptable — `Save` ' +
          'stays disabled and Enter is a no-op until it does.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<PresetNameDialogComponent>;

/**
 * `lib-preset-name-dialog` is a plain presentational component with no internal
 * show/hide state (unlike `dropdown-dialog`'s imperative CDK overlay), so an args-only
 * story already renders it "open" by default.
 */
export const Default: Story = {
  args: {
    title: 'Save Preset',
    initialValue: 'My CRT Look',
    reservedNames: ['Default', 'Vibrant'],
    validationFn: validateName,
  },
};
