import type { Meta, StoryObj } from '@storybook/angular';
import { NgTemplateOutlet } from '@angular/common';
import { SwipePaneDirective } from './swipe-pane.directive';

const meta: Meta<SwipePaneDirective> = {
  title: 'Overlay & Interaction/Swipe Pane',
  component: SwipePaneDirective,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<SwipePaneDirective>;

/**
 * `[libSwipePane]` only captures a `TemplateRef` and a `label` — it renders nothing on
 * its own, so it's applied to an `<ng-template>` here (matching how
 * `lib-swipe-pane-container` consumes it) and stamped out via `NgTemplateOutlet` on a
 * minimal host to make the captured content visible.
 */
export const Default: Story = {
  render: () => ({
    moduleMetadata: {
      imports: [NgTemplateOutlet],
    },
    template: `
      <ng-template libSwipePane label="Pane One" #pane>
        <div style="padding: 24px; background: #222; color: #fff;">Pane content</div>
      </ng-template>
      <ng-container [ngTemplateOutlet]="pane"></ng-container>
    `,
  }),
};
