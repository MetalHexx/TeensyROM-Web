import type { Meta, StoryObj } from '@storybook/angular';
import { CycleImageComponent } from './cycle-image.component';

const meta: Meta<CycleImageComponent> = {
  title: 'Primitives/Cycle Image',
  component: CycleImageComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Image carousel that automatically cross-fades through the \`images\` array, falling back to \`placeholderUrl\` when empty and working correctly for the single-image case (no cycling triggered). \`size\` selects both dimensions and rendering mode: \`thumbnail\`/\`small\` are simple \`object-fit: cover\` presentations with no blur, while \`medium\`/\`large\` add a dual-layer blurred background behind an \`object-fit: contain\` foreground. \`width\`/\`height\` override the size preset for non-standard aspect ratios (e.g. C64 320x200 screenshots).

Use \`CycleImageComponent\` whenever the source data may hold zero, one, or many images. Use \`ThumbnailImageComponent\` instead only when there is always exactly one known image and the simpler, non-cycling component is sufficient.
        `.trim(),
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['thumbnail', 'small', 'medium', 'large'],
    },
  },
};

export default meta;
type Story = StoryObj<CycleImageComponent>;

export const Default: Story = {
  args: {
    images: ['https://placehold.co/400x300', 'https://placehold.co/400x300/222/fff'],
    intervalMs: 8000,
    placeholderUrl: '/placeholder.jpg',
    size: 'large',
    width: undefined,
    height: undefined,
  },
};
