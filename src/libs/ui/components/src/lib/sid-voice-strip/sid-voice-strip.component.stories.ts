import { AfterViewInit, ChangeDetectionStrategy, Component, input, viewChild } from '@angular/core';
import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { SidVoiceStripComponent, SidVoiceStripModel } from './sid-voice-strip.component';

function knob(name: string, value: number, min: number, max: number, home: number, unit?: string) {
  return {
    value,
    min,
    max,
    home,
    step: (max - min) / 100,
    accessibleName: `Deck A voice 1 ${name}`,
    valueUnit: unit ?? null,
  };
}

function atRest(): SidVoiceStripModel {
  return {
    title: 'Voice 1',
    knobs: {
      coarse: knob('coarse', 0, -12, 12, 0, 'semitones'),
      fine: knob('fine', 0, -100, 100, 0, 'cents'),
      pulseWidth: knob('pulse width', 0, 0, 1, 0),
      attack: knob('attack', 0, 0, 1, 0),
      decay: knob('decay', 0, 0, 1, 0),
      sustain: knob('sustain', 0, 0, 1, 0),
      release: knob('release', 0, 0, 1, 0),
    },
    waveformLock: null,
    waveformNames: {
      triangle: 'Triangle, voice 1',
      sawtooth: 'Sawtooth, voice 1',
      pulse: 'Pulse, voice 1',
      noise: 'Noise, voice 1',
    },
    switches: {
      ring: { locked: false, accessibleName: 'Ring modulation, voice 1' },
      sync: { locked: false, accessibleName: 'Hard sync, voice 1' },
      filter: { locked: false, accessibleName: 'Route to filter, voice 1' },
    },
    disabled: false,
  };
}

function offHome(): SidVoiceStripModel {
  const model = atRest();
  return {
    ...model,
    knobs: {
      coarse: { ...model.knobs.coarse, value: 5 },
      fine: { ...model.knobs.fine, value: -40 },
      pulseWidth: { ...model.knobs.pulseWidth, value: 0.6 },
      attack: { ...model.knobs.attack, value: 0.2 },
      decay: { ...model.knobs.decay, value: 0.5 },
      sustain: { ...model.knobs.sustain, value: 0.8 },
      release: { ...model.knobs.release, value: 0.35 },
    },
  };
}

/** Drives `liveTargets()` once after render, the way a painter would. */
@Component({
  selector: 'lib-sid-voice-strip-live-demo',
  imports: [SidVoiceStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div style="width: 78px; padding: 8px; background: var(--synth-face);">
    <lib-sid-voice-strip [model]="model()" />
  </div>`,
})
class LiveDemoComponent implements AfterViewInit {
  readonly model = input.required<SidVoiceStripModel>();
  /** Lights sawtooth under a triangle lock, so the ghost shows beside the lock. */
  readonly ghostSawtooth = input(false);

  private readonly strip = viewChild.required(SidVoiceStripComponent);

  ngAfterViewInit(): void {
    const t = this.strip().liveTargets();
    if (this.ghostSawtooth()) {
      t.waveforms[1].setLiveLight(false, true);
      t.waveforms[0].setLiveLight(true, false);
      return;
    }
    t.waveforms[2].setLiveLight(true, false);
    t.coarse.setLiveLevel(0.6);
    t.fine.setLiveLevel(0.45);
    t.pulseWidth.setLiveLevel(0.7);
    t.attack.setLiveLevel(0.2);
    t.decay.setLiveLevel(0.5);
    t.sustain.setLiveLevel(0.8);
    t.release.setLiveLevel(0.35);
    t.ring.setLiveLight(true, false);
    t.filter.setLiveLight(true, false);
  }
}

const meta: Meta<SidVoiceStripComponent> = {
  title: 'DJ/SID Voice Strip',
  component: SidVoiceStripComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [LiveDemoComponent] })],
  parameters: {
    docs: {
      description: {
        component:
          "One SID voice's panel strip: four waveform buttons, Coarse and Fine, pulse width, " +
          'A/D/S/R and the Ring/Sync/Filt switches. It holds no state: a `model` goes in; ' +
          '`knobChange`, `waveformPress` and `switchPress` report what the hand did. A painter ' +
          'sets the live indicators through `liveTargets()`, valid once the view has rendered. ' +
          "The feature sets `data-voice` on the strip's host.",
      },
    },
  },
  argTypes: {
    model: { description: 'Everything the strip draws; the application owns every value.' },
    knobChange: { description: 'Emits `{ knob, value }` when a knob moves.' },
    waveformPress: { description: 'Emits the pressed waveform.' },
    switchPress: { description: 'Emits the pressed switch.' },
  },
};

export default meta;
type Story = StoryObj<SidVoiceStripComponent>;

const frame = (inner: string) => `
  <div style="width: 78px; padding: 8px; background: var(--synth-face);">${inner}</div>`;

const render: Story['render'] = (args) => ({
  props: args,
  template: frame('<lib-sid-voice-strip [model]="model" />'),
});

export const AtRest: Story = { args: { model: atRest() }, render };

export const OffsetsOffHome: Story = { args: { model: offHome() }, render };

export const WaveformLocked: Story = {
  args: { model: { ...atRest(), waveformLock: 'triangle' } },
  render,
};

/** Triangle is locked; the tune's own choice, sawtooth, shows as a ghost. */
export const WaveformLockWithGhost: Story = {
  render: () => ({
    props: { model: { ...atRest(), waveformLock: 'triangle' } },
    template:
      '<lib-sid-voice-strip-live-demo [model]="model" [ghostSawtooth]="true" />',
  }),
};

export const SwitchLocked: Story = {
  args: {
    model: {
      ...atRest(),
      switches: {
        ring: { locked: false, accessibleName: 'Ring modulation, voice 1' },
        sync: { locked: true, accessibleName: 'Hard sync, voice 1' },
        filter: { locked: false, accessibleName: 'Route to filter, voice 1' },
      },
    },
  },
  render,
};

export const Disabled: Story = { args: { model: { ...atRest(), disabled: true } }, render };

export const Live: Story = {
  render: () => ({
    props: { model: offHome() },
    template: '<lib-sid-voice-strip-live-demo [model]="model" />',
  }),
};

/** Three strips in the DJ view's mixer column: about 78px each, with no horizontal overflow. */
export const ThreeAcross: Story = {
  render: () => ({
    props: { model: offHome() },
    template: `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 280px; padding: 8px; box-sizing: border-box; background: var(--synth-face);">
        <lib-sid-voice-strip [model]="model" />
        <lib-sid-voice-strip [model]="model" />
        <lib-sid-voice-strip [model]="model" />
      </div>
    `,
  }),
};
