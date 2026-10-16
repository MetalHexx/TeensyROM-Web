import type { Meta, StoryObj } from '@storybook/angular';
import {
  MappingOverlayLayerComponent,
  MappingOverlayState,
  MappingOverlayTarget,
} from './mapping-overlay-layer.component';

const meta: Meta<MappingOverlayLayerComponent> = {
  title: 'DJ/Mapping Overlay Layer',
  component: MappingOverlayLayerComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Draws one overlay button on each target control's own box, for picking which control a " +
          'hardware input maps onto. The host fills a `position: relative` container without ' +
          "catching its pointer events; each target's `anchor` selector is resolved inside `scope`, " +
          'and one that matches nothing renders no overlay. While an overlay exists its control is ' +
          'made `inert` — it cannot be operated or focused — and is restored when the target goes ' +
          'or the layer is destroyed. Positions follow `targets`, `scope`, any resize of the scope ' +
          'or an anchor, and the window. Line style and weight carry the state, not colour alone: ' +
          '`selectable` is a thin dashed border, `selected` a thick solid one with an outer ring, ' +
          '`bound` a thin solid border in the accent colour. Escape on any overlay emits `dismiss`.',
      },
    },
  },
  argTypes: {
    targets: {
      description:
        'The controls to draw an overlay on: `{ id, anchor, state, accessibleName }`. `anchor` is a ' +
        'CSS selector resolved inside `scope`; `id` is emitted back by `targetSelect`.',
    },
    scope: {
      description: "The element every target's `anchor` selector is resolved inside.",
    },
    targetSelect: {
      description: 'Emits the `id` of the target whose overlay was activated.',
    },
    dismiss: {
      description: 'Emits when Escape is pressed on any overlay.',
    },
  },
};

export default meta;
type Story = StoryObj<MappingOverlayLayerComponent>;

function target(id: string, state: MappingOverlayState): MappingOverlayTarget {
  return { id, anchor: `[data-control="${id}"]`, state, accessibleName: `Map ${id}` };
}

/** A small fixture of anchored controls, with the layer on top. The layer is the last child of the
 *  `position: relative` container, and the container itself is the scope. */
const FIXTURE = `
  <div
    #fixture
    style="position: relative; display: flex; align-items: center; gap: 24px; width: 560px;
           padding: 28px 24px; border-radius: 10px; background: #231e22; color: #e9e0e4;"
  >
    <button type="button" data-control="play-pause">Play</button>
    <button type="button" data-control="stop">Stop</button>
    <label data-control="repeat" style="display: inline-flex; align-items: center; gap: 8px;">
      <input type="checkbox" /> Repeat track
    </label>
    <input type="range" data-control="speed" aria-label="Speed" style="width: 120px;" />
    <lib-mapping-overlay-layer
      [targets]="targets"
      [scope]="fixture"
      (targetSelect)="onTargetSelect($event)"
      (dismiss)="onDismiss()"
    />
  </div>
`;

/** One control in each state, and `speed` unbound and unmarked — a target that is not listed gets
 *  no overlay, and stays operable. */
export const AllStates: Story = {
  render: () => ({
    props: {
      targets: [
        target('play-pause', 'bound'),
        target('stop', 'selectable'),
        target('repeat', 'selected'),
      ],
      onTargetSelect: () => undefined,
      onDismiss: () => undefined,
    },
    template: FIXTURE,
  }),
};

/** Interactive: activating an overlay selects it, and Escape on any overlay clears the selection,
 *  as a caller driving a mapping flow would. Tab between the overlays — the controls underneath
 *  are inert. */
export const Interactive: Story = {
  render: () => ({
    props: {
      targets: [
        target('play-pause', 'bound'),
        target('stop', 'selectable'),
        target('repeat', 'selectable'),
        target('speed', 'selectable'),
      ],
      onTargetSelect(this: { targets: MappingOverlayTarget[] }, id: string) {
        this.targets = this.targets.map((candidate) => ({
          ...candidate,
          state:
            candidate.id === id
              ? 'selected'
              : candidate.state === 'selected'
              ? 'selectable'
              : candidate.state,
        }));
      },
      onDismiss(this: { targets: MappingOverlayTarget[] }) {
        this.targets = this.targets.map((candidate) => ({
          ...candidate,
          state: candidate.state === 'selected' ? 'selectable' : candidate.state,
        }));
      },
    },
    template: FIXTURE,
  }),
};

/** The keyboard focus ring: a 2px solid white outline at 3px offset. Focus is moved onto the first
 *  overlay once it has rendered. */
export const Focused: Story = {
  render: () => ({
    props: {
      targets: [
        target('play-pause', 'selectable'),
        target('stop', 'selected'),
        target('repeat', 'bound'),
      ],
      onTargetSelect: () => undefined,
      onDismiss: () => undefined,
    },
    template: FIXTURE,
  }),
  play: async ({ canvasElement }) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const overlay = canvasElement.querySelector<HTMLButtonElement>('.mapping-overlay');
      if (overlay) {
        overlay.focus();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  },
};
