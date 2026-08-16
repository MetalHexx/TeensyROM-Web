import type { Meta, StoryObj } from '@storybook/angular';
import { SwipePaneContainerComponent } from './swipe-pane-container.component';
import { SwipePaneDirective } from './swipe-pane.directive';

const meta: Meta<SwipePaneContainerComponent> = {
  title: 'Overlay & Interaction/Swipe Pane Container',
  component: SwipePaneContainerComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`lib-swipe-pane-container` is a horizontally-scrolling, snap-to-pane container ' +
          'for mobile-style tab panels. Panes come from projected `<ng-template libSwipePane>` ' +
          'content (each marked with `SwipePaneDirective`), not from an input — the container ' +
          'reads them via `contentChildren(SwipePaneDirective)`, so an empty container has ' +
          'nothing to swipe between. On touch devices, panes are navigated by scroll/swipe ' +
          'gesture; on non-touch devices, hovering the swipe area reveals arrow controls and ' +
          'pagination dots instead, since there is no native swipe gesture available.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<SwipePaneContainerComponent>;

/**
 * `lib-swipe-pane-container` reads its panes from `contentChildren(SwipePaneDirective)`,
 * so an empty container has nothing to swipe between. This story projects three
 * `<ng-template libSwipePane>` panes with representative content.
 */
export const Default: Story = {
  args: {
    initialPane: 0,
  },
  render: (args) => ({
    props: args,
    moduleMetadata: {
      imports: [SwipePaneDirective],
    },
    template: `
      <lib-swipe-pane-container [initialPane]="initialPane">
        <ng-template libSwipePane label="Overview">
          <div style="padding: 24px; box-sizing: border-box; background: #222; color: #fff;">Overview pane</div>
        </ng-template>
        <ng-template libSwipePane label="Details">
          <div style="padding: 24px; box-sizing: border-box; background: #333; color: #fff;">Details pane</div>
        </ng-template>
        <ng-template libSwipePane label="Settings">
          <div style="padding: 24px; box-sizing: border-box; background: #444; color: #fff;">Settings pane</div>
        </ng-template>
      </lib-swipe-pane-container>
    `,
  }),
};
