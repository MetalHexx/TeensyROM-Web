import type { Meta, StoryObj } from '@storybook/angular';
import { SwipePaneContainerComponent } from './swipe-pane-container.component';
import { SwipePaneDirective } from './swipe-pane.directive';

const meta: Meta<SwipePaneContainerComponent> = {
  title: 'Overlay & Interaction/Swipe Pane Container',
  component: SwipePaneContainerComponent,
  tags: ['autodocs'],
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
