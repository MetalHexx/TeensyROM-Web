import type { Meta, StoryObj } from '@storybook/angular';
import { InputFieldComponent } from './input-field.component';

const meta: Meta<InputFieldComponent> = {
  title: 'Primitives/Input Field',
  component: InputFieldComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A compact, icon-led text input for search and filter boxes. It ships with a leading `search` icon, an optional clear button, and hover tooltips for both the field and the clear button, and implements `ControlValueAccessor` so it works with template-driven and reactive forms without any extra wiring. Reach for `InputFieldComponent` when you need a simple, self-contained text field — search bars, filter boxes, quick single-line inputs. For forms that need labels, hints, or validation messaging, use Material's form field components directly instead; `InputFieldComponent` intentionally leaves those out to stay lightweight.",
      },
    },
  },
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
