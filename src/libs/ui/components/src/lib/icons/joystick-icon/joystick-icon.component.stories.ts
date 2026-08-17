import type { Meta, StoryObj } from '@storybook/angular';
import { JoystickIconComponent } from './joystick-icon.component';

const meta: Meta<JoystickIconComponent> = {
  title: 'Primitives/Joystick Icon',
  component: JoystickIconComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Fixed-artwork SVG icon depicting a joystick/controller. Has no inputs or outputs — it inherits size and color from its parent via \`fill: currentColor\` and is designed to be projected into \`IconButtonComponent\` as an alternative to a Material icon ligature (\`<lib-icon-button><lib-joystick-icon /></lib-icon-button>\`), typically for "games" filter controls.

For any other icon need, prefer \`StyledIconComponent\` with a Material icon name over adding another one-off SVG component like this one.
        `.trim(),
      },
    },
  },
};

export default meta;
type Story = StoryObj<JoystickIconComponent>;

export const Default: Story = {
  args: {},
};
