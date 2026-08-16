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
