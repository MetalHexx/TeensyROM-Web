import type { Meta, StoryObj } from '@storybook/angular';
import { ScrollingMarqueeComponent } from './scrolling-marquee.component';

const meta: Meta<ScrollingMarqueeComponent> = {
  title: 'Primitives/Scrolling Marquee',
  component: ScrollingMarqueeComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Scrolls text that's too long for its container instead of truncating it, using a hardware-accelerated CSS transform and a duration calculated from content width and `speed` — long text scrolls longer rather than faster, keeping reading speed roughly constant. Layer an `effect` on top for a retro demoscene feel (`wave`, `rainbow`, `glitch`, `bounce`, `copper`, `spiral`, or `random` to rotate between them). Choose this over `IconLabelComponent`'s `truncate` option when the full text matters and cutting it off with an ellipsis would lose information the user needs — file descriptions, notification banners, status bars with dynamic content.",
      },
    },
  },
  argTypes: {
    direction: {
      control: 'select',
      options: ['left', 'right'],
    },
    effect: {
      control: 'select',
      options: ['none', 'wave', 'rainbow', 'glitch', 'bounce', 'copper', 'spiral', 'random'],
    },
  },
};

export default meta;
type Story = StoryObj<ScrollingMarqueeComponent>;

export const Default: Story = {
  args: {
    text: 'Breaking news: this text scrolls continuously across the marquee.',
    speed: 50,
    direction: 'left',
    pauseOnHover: true,
    effect: 'none',
  },
};
