import type { Meta, StoryObj } from '@storybook/angular';
import { InputFieldComponent } from './input-field.component';

const meta: Meta<InputFieldComponent> = {
  title: 'Primitives/Input Field',
  component: InputFieldComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<InputFieldComponent>;

export const Default: Story = {
  args: {
    placeholder: 'Search files...',
    inputType: 'text',
    disabled: false,
    clearable: true,
  },
};
