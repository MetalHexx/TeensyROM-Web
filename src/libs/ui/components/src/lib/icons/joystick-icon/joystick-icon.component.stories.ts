import type { Meta, StoryObj } from '@storybook/angular';
import { JoystickIconComponent } from './joystick-icon.component';

const meta: Meta<JoystickIconComponent> = {
  title: 'Primitives/Joystick Icon',
  component: JoystickIconComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<JoystickIconComponent>;

export const Default: Story = {
  args: {},
};
