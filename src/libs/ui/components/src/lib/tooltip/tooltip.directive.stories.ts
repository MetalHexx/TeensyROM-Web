import type { Meta, StoryObj } from '@storybook/angular';
import { TooltipDirective, TooltipConfig, TooltipPosition, TooltipTitleColor } from './tooltip.directive';

const meta: Meta<TooltipDirective> = {
  title: 'Overlay & Interaction/Tooltip',
  component: TooltipDirective,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`[libTooltip]` replaces Angular Material\'s `matTooltip`, whose CDK overlay ' +
          'created z-index conflicts with this app\'s animated dialogs and modal containers. ' +
          'It has no template or overlay of its own — actual rendering, positioning, and ' +
          'viewport-overflow flipping is delegated to `TooltipRendererService`, which appends ' +
          'the tooltip directly to `document.body` (or the fullscreen element) via `Renderer2`. ' +
          'Tooltips are shown on hover with a configurable `delay` and are disabled entirely ' +
          'on touch devices to avoid "stuck" tooltip UX. Pass a `TooltipConfig` with `body` ' +
          'and/or `title` — at least one is required for anything to render.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<TooltipDirective>;

/**
 * `[libTooltip]` has no template of its own, so it's documented applied to a real host
 * element (a button), per the directive's own JSDoc `@example`. Hover the button to see
 * the tooltip after its configured delay — this isn't asserted by any automated test here.
 */
export const Default: Story = {
  args: {
    libTooltip: {
      body: 'Click to save',
      position: TooltipPosition.Bottom,
    } as TooltipConfig,
  },
  render: (args) => ({
    props: args,
    template: `<button [libTooltip]="libTooltip" style="padding: 8px 16px;">Save</button>`,
  }),
};

export const WithTitle: Story = {
  args: {
    libTooltip: {
      title: 'Save',
      titleColor: TooltipTitleColor.Highlight,
      body: 'Click to save changes',
      position: TooltipPosition.Top,
    } as TooltipConfig,
  },
  render: (args) => ({
    props: args,
    template: `<button [libTooltip]="libTooltip" style="padding: 8px 16px;">Save</button>`,
  }),
};
