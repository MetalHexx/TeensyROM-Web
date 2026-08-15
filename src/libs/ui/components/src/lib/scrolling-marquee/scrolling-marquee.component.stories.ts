import type { Meta, StoryObj } from '@storybook/angular';
import { ScrollingMarqueeComponent } from './scrolling-marquee.component';

const meta: Meta<ScrollingMarqueeComponent> = {
  title: 'Primitives/Scrolling Marquee',
  component: ScrollingMarqueeComponent,
  tags: ['autodocs'],
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
