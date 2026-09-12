import type { Meta, StoryObj } from '@storybook/angular';
import { StepperComponent } from './stepper.component';

const meta: Meta<StepperComponent> = {
  title: 'DJ/Stepper',
  component: StepperComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Previous/next buttons with a caption between them. Generic — nothing about subtunes, ' +
          'tracks, or any other caller concept appears in it; the caption and both accessible names ' +
          'are entirely caller-composed.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<StepperComponent>;

export const Default: Story = {
  args: {
    text: 'Subtune 1 of 3',
    previousAccessibleName: 'Previous subtune deck A',
    nextAccessibleName: 'Next subtune deck A',
  },
};

export const Disabled: Story = {
  args: {
    text: 'Subtune 1 of 1',
    previousDisabled: true,
    nextDisabled: true,
    previousAccessibleName: 'Previous subtune deck A',
    nextAccessibleName: 'Next subtune deck A',
  },
};
