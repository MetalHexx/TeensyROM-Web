import { AfterViewInit, ChangeDetectionStrategy, Component, QueryList, ViewChildren } from '@angular/core';
import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { RotaryKnobComponent } from './rotary-knob.component';

/** Calls `setLiveLevel` on each knob once rendered, the way a painter would each frame. */
@Component({
  selector: 'lib-rotary-knob-live-ring-demo',
  imports: [RotaryKnobComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display: flex; align-items: flex-end; gap: 24px; padding: 8px;">
      @for (level of levels; track level) {
      <lib-rotary-knob
        [label]="'Live ' + level"
        accessibleName="Live ring demo"
        [value]="0.3"
        [min]="0"
        [max]="1"
        [home]="0"
        appearance="panel"
        [liveRing]="true"
        size="extra-large"
      />
      }
    </div>
  `,
})
class LiveRingDemoComponent implements AfterViewInit {
  protected readonly levels = [0, 0.25, 0.5, 0.75, 1];

  @ViewChildren(RotaryKnobComponent) private readonly knobs!: QueryList<RotaryKnobComponent>;

  ngAfterViewInit(): void {
    this.knobs.forEach((knob, i) => knob.setLiveLevel(this.levels[i]));
  }
}

const meta: Meta<RotaryKnobComponent> = {
  title: 'DJ/Rotary Knob',
  component: RotaryKnobComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [LiveRingDemoComponent] })],
  argTypes: {
    label: { description: 'Caption under the dial. An empty label renders no caption.' },
    size: { description: "The dial's rendered size across the shared `ControlSize` scale." },
    accessibleName: { description: 'Accessible name of the native range input; the caller composes it.' },
    value: { description: "The dial's current position, between `min` and `max`." },
    min: { description: "Minimum of the dial's range. Defaults to -1." },
    max: { description: "Maximum of the dial's range. Defaults to 1." },
    step: { description: 'Granularity of the native range input. Defaults to 0.01.' },
    home: {
      description:
        'The rest position the dial returns to on double-click. Equal to `min` makes the dial rest lower-left and sweep 270°.',
    },
    readout: { description: 'Text rendered under the dial when present.' },
    disabled: { description: 'Disables the native range input and dims the dial.' },
    appearance: {
      description: "`'default'` is the outline dial; `'panel'` draws the SID panel's skirt, cap, white pointer and magenta offset arc.",
      control: 'inline-radio',
      options: ['default', 'panel'],
    },
    liveRing: {
      description:
        "Draws an outer live ring in the panel look, whose length `setLiveLevel` sets. Has no effect in the default appearance.",
    },
    valueUnit: {
      description: 'Appended to the value text (aria-valuetext) off home, e.g. "+12 semitones".',
    },
    valueChange: { description: "Emits the dial's new position on drag, keyboard input, or double-click-to-home." },
  },
  parameters: {
    docs: {
      description: {
        component:
          "A single rotary parameter control — cutoff, resonance, pulse width, key — driven by a " +
          "transparent native range input layered over a decorative SVG dial, so keyboard operation " +
          "and assistive-technology state come for free. A vertical drag sweeps `min()`..`max()` " +
          "(DAW convention, not the native range's own click-and-drag), Shift quarters the " +
          "sensitivity for fine adjustment, and a double-click snaps back to `home()`. A `home()` equal " +
          "to `min()` makes the dial rest lower-left and sweep the full 270° to `max()`. Reach for it " +
          "for any bounded numeric parameter that benefits from a compact rotary affordance rather " +
          "than a linear fader like `ChannelFaderComponent`. `size` steps the dial and its own " +
          "label/readout font across the shared `ControlSize` scale; `'large'` is the default and " +
          "renders pixel-identical to every use that predates this input. " +
          "`disabled` dims the dial and makes it inert to keyboard, drag and double-click. " +
          "`appearance=\"panel\"` redraws the dial as the SID panel's (skirt, cap, white pointer, magenta " +
          "offset arc), `liveRing` adds an outer ring there that `setLiveLevel(0..1)` drives directly " +
          "on the DOM without change detection, and `valueUnit` appends a unit to the off-home value text.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<RotaryKnobComponent>;

export const Default: Story = {
  args: { value: 0 }, // seed it — unseeded, `value` starts undefined and the dial draws NaN geometry
  render: (args) => ({
    props: { ...args, onValueChange(v: number) { this['value'] = v; } },
    template: `<lib-rotary-knob label="Cutoff" accessibleName="Cutoff demo"
                 [value]="value" (valueChange)="onValueChange($event)" />`,
  }),
};

/** All four `ControlSize` steps side by side, each still at rest (`value` at `home`). */
export const Sizes: Story = {
  render: () => ({
    template: `
      <div style="display: flex; align-items: flex-end; gap: 24px;">
        <lib-rotary-knob label="Small" accessibleName="Small demo" [value]="0" size="small" />
        <lib-rotary-knob label="Medium" accessibleName="Medium demo" [value]="0" size="medium" />
        <lib-rotary-knob label="Large" accessibleName="Large demo" [value]="0" size="large" />
        <lib-rotary-knob label="Extra Large" accessibleName="Extra Large demo" [value]="0" size="extra-large" />
      </div>
    `,
  }),
};

/** A knob whose `home` equals its `min` rests lower-left and sweeps the full 270° to `max`, its
 *  ring growing clockwise from the start and no top tick drawn — one at rest, one turned. */
export const RestingAtMinimum: Story = {
  render: () => ({
    template: `
      <div style="display: flex; align-items: flex-end; gap: 24px;">
        <lib-rotary-knob label="At rest" accessibleName="At rest demo" [value]="0" [min]="0" [max]="1" [home]="0" />
        <lib-rotary-knob label="Turned" accessibleName="Turned demo" [value]="0.6" [min]="0" [max]="1" [home]="0" />
      </div>
    `,
  }),
};

/** `disabled` dims the dial and makes it inert to keyboard, drag and double-click. */
export const Disabled: Story = {
  render: () => ({
    template: `<lib-rotary-knob label="Cutoff" accessibleName="Cutoff demo" [value]="0.4" [disabled]="true" />`,
  }),
};

/** The panel look at rest, and turned either way. */
export const PanelAppearance: Story = {
  render: () => ({
    template: `
      <div style="display: flex; align-items: flex-end; gap: 24px; padding: 8px;">
        <lib-rotary-knob label="At rest" accessibleName="At rest demo" [value]="0" appearance="panel" size="extra-large" />
        <lib-rotary-knob label="Left" accessibleName="Left demo" [value]="-0.6" appearance="panel" size="extra-large" valueUnit="cents" />
        <lib-rotary-knob label="Right" accessibleName="Right demo" [value]="0.6" appearance="panel" size="extra-large" valueUnit="cents" />
        <lib-rotary-knob label="Minimum" accessibleName="Minimum demo" [value]="0.6" [min]="0" [max]="1" [home]="0" appearance="panel" size="extra-large" />
      </div>
    `,
  }),
};

/** `setLiveLevel` called after render at several levels, from empty to full. */
export const LiveRing: Story = {
  render: () => ({ template: `<lib-rotary-knob-live-ring-demo />` }),
};

/** All four `ControlSize` steps in the panel look. */
export const PanelSizes: Story = {
  render: () => ({
    template: `
      <div style="display: flex; align-items: flex-end; gap: 24px; padding: 8px;">
        <lib-rotary-knob label="Small" accessibleName="Small demo" [value]="0.4" size="small" appearance="panel" />
        <lib-rotary-knob label="Medium" accessibleName="Medium demo" [value]="0.4" size="medium" appearance="panel" />
        <lib-rotary-knob label="Large" accessibleName="Large demo" [value]="0.4" size="large" appearance="panel" />
        <lib-rotary-knob label="Extra Large" accessibleName="Extra Large demo" [value]="0.4" size="extra-large" appearance="panel" />
      </div>
    `,
  }),
};
