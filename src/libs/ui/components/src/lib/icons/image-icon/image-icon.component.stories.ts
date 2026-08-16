import type { Meta, StoryObj } from '@storybook/angular';
import { ImageIconComponent } from './image-icon.component';

const meta: Meta<ImageIconComponent> = {
  title: 'Primitives/Image Icon',
  component: ImageIconComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Fixed-artwork SVG icon depicting a photo/image. Has no inputs or outputs — it inherits size and color from its parent via \`fill: currentColor\` and is designed to be projected into \`IconButtonComponent\` as an alternative to a Material icon ligature (\`<lib-icon-button><lib-image-icon /></lib-icon-button>\`), typically for "images/photos" filter controls.

For any other icon need, prefer \`StyledIconComponent\` with a Material icon name over adding another one-off SVG component like this one.
        `.trim(),
      },
    },
  },
};

export default meta;
type Story = StoryObj<ImageIconComponent>;

export const Default: Story = {
  args: {},
};
