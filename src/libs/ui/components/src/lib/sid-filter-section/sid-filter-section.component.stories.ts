import { AfterViewInit, ChangeDetectionStrategy, Component, input, viewChild } from '@angular/core';
import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { SidFilterSectionComponent, SidFilterSectionModel } from './sid-filter-section.component';

function atRest(): SidFilterSectionModel {
  return {
    cutoff: {
      value: 0,
      min: -1,
      max: 1,
      home: 0,
      step: 0.02,
      accessibleName: 'Deck A filter cutoff',
    },
    resonance: {
      value: 0,
      min: 0,
      max: 1,
      home: 0,
      step: 0.01,
      accessibleName: 'Deck A filter resonance',
    },
    modeLock: null,
    modeNames: {
      'low-pass': 'Low-pass filter',
      'band-pass': 'Band-pass filter',
      'high-pass': 'High-pass filter',
    },
    disabled: false,
  };
}

function offHome(): SidFilterSectionModel {
  const model = atRest();
  return {
    ...model,
    cutoff: { ...model.cutoff, value: 0.4 },
    resonance: { ...model.resonance, value: 0.55 },
  };
}

/** Drives `liveTargets()` once after render, the way a painter would. */
@Component({
  selector: 'lib-sid-filter-section-live-demo',
  imports: [SidFilterSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div style="width: 200px; padding: 8px; background: var(--synth-face);">
    <lib-sid-filter-section [model]="model()" />
  </div>`,
})
class LiveDemoComponent implements AfterViewInit {
  readonly model = input.required<SidFilterSectionModel>();
  /** Lights low-pass, with band-pass as the tune's own (ghosted) choice. */
  readonly ghost = input(false);

  private readonly section = viewChild.required(SidFilterSectionComponent);

  ngAfterViewInit(): void {
    const t = this.section().liveTargets();
    t.cutoff.setLiveLevel(0.65);
    t.resonance.setLiveLevel(0.3);
    t.modes[0].setLiveLight(true, false);
    if (this.ghost()) {
      t.modes[1].setLiveLight(false, true);
    }
  }
}

const meta: Meta<SidFilterSectionComponent> = {
  title: 'DJ/SID Filter Section',
  component: SidFilterSectionComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [LiveDemoComponent] })],
  parameters: {
    docs: {
      description: {
        component:
          'The SID panel filter section: Cutoff and Res knobs and an LP/BP/HP column of switches. ' +
          'It holds no state: a `model` goes in; `knobChange` and `modePress` report what the ' +
          'hand did. A painter sets the live indicators through `liveTargets()`, valid once the ' +
          'view has rendered.',
      },
    },
  },
  argTypes: {
    model: { description: 'Everything the section draws; the application owns every value.' },
    knobChange: { description: 'Emits `{ knob, value }` when Cutoff or Res moves.' },
    modePress: { description: 'Emits the pressed filter mode.' },
  },
};

export default meta;
type Story = StoryObj<SidFilterSectionComponent>;

const render: Story['render'] = (args) => ({
  props: args,
  template: `
    <div style="width: 200px; padding: 8px; background: var(--synth-face);">
      <lib-sid-filter-section [model]="model" />
    </div>`,
});

export const AtRest: Story = { args: { model: atRest() }, render };

export const OffsetsOffHome: Story = { args: { model: offHome() }, render };

export const ModeLocked: Story = { args: { model: { ...atRest(), modeLock: 'low-pass' } }, render };

/** Low-pass is locked; the tune's own choice, band-pass, shows as a ghost. */
export const ModeLockWithGhost: Story = {
  render: () => ({
    props: { model: { ...offHome(), modeLock: 'low-pass' } },
    template: '<lib-sid-filter-section-live-demo [model]="model" [ghost]="true" />',
  }),
};

export const Disabled: Story = { args: { model: { ...atRest(), disabled: true } }, render };

export const Live: Story = {
  render: () => ({
    props: { model: offHome() },
    template: '<lib-sid-filter-section-live-demo [model]="model" />',
  }),
};
