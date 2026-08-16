import type { Meta, StoryObj } from '@storybook/angular';
import { ThumbnailImageComponent } from './thumbnail-image.component';

const meta: Meta<ThumbnailImageComponent> = {
  title: 'Primitives/Thumbnail Image',
  component: ThumbnailImageComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Compact, static image thumbnail for cover art, album artwork, and file previews. Renders nothing when \`imageUrl\` is \`null\`, so it's safe to bind directly to optional image data without a guard.

Use \`ThumbnailImageComponent\` for a single static image. Use \`CycleImageComponent\` instead when there may be zero, one, or many images to show — it adds automatic cycling and placeholder handling that this component intentionally omits.
        `.trim(),
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
  },
};

export default meta;
type Story = StoryObj<ThumbnailImageComponent>;

export const Default: Story = {
  args: {
    imageUrl: 'https://placehold.co/200x200',
    size: 'medium',
  },
};
