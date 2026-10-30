// Worker route: the stories use the renderer's default worker factory, so they run the real worker.
// Storybook's webpack builder bundles it once `.storybook/tsconfig.json` includes `*.worker.ts`
// (without that, the Angular loader rejects the worker as missing from the compilation). No
// stand-in, main-thread drawing path or dynamic import is needed.
//
// Theme: Storybook's theme toggle changes the `dark-mode` class on `html` directly instead of going
// through `ThemeService`, so the renderer is never told and the traces do not recolour on a toggle.
// Reload the story after toggling to see the other palette.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import type { WaveWindowState } from './model/wave-view';
import type { WaveVoiceFields } from './wave-feed-buffer';
import {
  WAVEFORM_NOISE,
  WAVEFORM_PULSE,
  WAVEFORM_SAWTOOTH,
  WAVEFORM_TRIANGLE,
} from './wave-feed-layout';
import { VoiceWaveRenderer } from './voice-wave-renderer';
import { VoiceWaveComponent } from './voice-wave.component';

/** Milliseconds between synthetic entries, about one video frame. */
const TICK_MS = 20;
/** The pattern repeats every 120 ticks (2.4 s): a kick every 30, an arpeggio step every 8, a pad for 90. */
const LOOP_TICKS = 120;
const KICK_PERIOD = 30;
const KICK_GATE_TICKS = 5;
const KICK_START_FREQUENCY = 14000;
const KICK_END_FREQUENCY = 1500;
const KICK_SWEEP_TICKS = 4;
const ARP_PERIOD = 8;
const ARP_GATE_TICKS = 5;
const ARP_NOTES = [6600, 8300, 9900, 13300];
const PAD_FREQUENCY = 5100;
const PAD_GATE_TICKS = 90;
/** The tick a window freezes on in the Held story: the kick and the arpeggio both just struck, and the pad is sustaining. */
const HOLD_TICK = 60;

const TRIANGLE_AND_PULSE = WAVEFORM_TRIANGLE | WAVEFORM_PULSE;

let nextBank = 1;

/** Each story render gets its own bank, so stories shown together on a docs page do not share a feed. */
function freshBank(): string {
  return `storybook-bank-${nextBank++}`;
}

interface Modulation {
  pulseWidth: number;
  ring: boolean;
  sync: boolean;
}

function voiceFields(
  waveform: number,
  frequency: number,
  gateOpen: boolean,
  hit: boolean,
  envelope: readonly [attack: number, decay: number, sustain: number, release: number],
  modulation: Modulation
): WaveVoiceFields {
  return {
    frequency,
    waveform,
    pulseWidth: modulation.pulseWidth,
    ring: modulation.ring ? 1 : 0,
    sync: modulation.sync ? 1 : 0,
    attack: envelope[0],
    decay: envelope[1],
    sustain: envelope[2],
    release: envelope[3],
    gate: gateOpen ? 1 : 0,
    hit: hit ? 1 : 0,
  };
}

/**
 * Feeds a bank through the real pipeline (`acquireFeed` and `submitFeed` on the renderer) with a
 * looping synthetic pattern: a kick, an arpeggio and a sustained pad on voices 1 to 3.
 */
@Component({
  selector: 'lib-wave-feed-driver',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class WaveFeedDriverComponent {
  readonly bank = input.required<string>();
  readonly waveform = input.required<number>();
  readonly ring = input(false);
  readonly sync = input(false);
  /** Emits on the loop's tick where every voice is sounding, once per loop. */
  readonly peak = output<void>();

  private readonly renderer = inject(VoiceWaveRenderer);
  private tick = 0;
  private restarted = true;

  constructor() {
    const timer = inject(NgZone).runOutsideAngular(() => setInterval(() => this.feed(), TICK_MS));
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.renderer.discardFeed(this.bank());
    });
    // Inputs are not set until the constructor returns.
    queueMicrotask(() => this.renderer.setBankState(this.bank(), 'playing'));
  }

  private feed(): void {
    const bank = this.bank();
    const feed = this.renderer.acquireFeed(bank);
    if (feed === null) return;

    const tick = this.tick++ % LOOP_TICKS;
    const waveform = this.waveform();
    const ring = this.ring();
    const sync = this.sync();

    const kickPhase = tick % KICK_PERIOD;
    const kickFrequency =
      KICK_END_FREQUENCY +
      (KICK_START_FREQUENCY - KICK_END_FREQUENCY) * Math.exp(-kickPhase / KICK_SWEEP_TICKS);
    const arpPhase = tick % ARP_PERIOD;
    const arpNote = ARP_NOTES[Math.floor(tick / ARP_PERIOD) % ARP_NOTES.length];

    feed.beginEntry(performance.now());
    feed.setVoice(
      0,
      voiceFields(
        waveform,
        kickFrequency,
        kickPhase < KICK_GATE_TICKS,
        kickPhase === 0,
        [0, 6, 0, 6],
        { pulseWidth: 2048, ring, sync }
      )
    );
    feed.setVoice(
      1,
      voiceFields(
        waveform,
        arpNote,
        arpPhase < ARP_GATE_TICKS,
        arpPhase === 0,
        [0, 5, 0, 5],
        { pulseWidth: 1024, ring, sync }
      )
    );
    feed.setVoice(
      2,
      voiceFields(
        waveform,
        PAD_FREQUENCY,
        tick < PAD_GATE_TICKS,
        tick === 0,
        [9, 8, 10, 9],
        { pulseWidth: 3072, ring, sync }
      )
    );
    feed.finish(this.restarted, 0);
    this.restarted = false;
    this.renderer.submitFeed(bank);
    if (tick === HOLD_TICK) this.peak.emit();
  }
}

const meta: Meta<VoiceWaveComponent> = {
  title: 'DJ/Voice Wave',
  component: VoiceWaveComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({ imports: [VoiceWaveComponent, WaveFeedDriverComponent] }),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "A 44px dark-glass window that draws one SID voice's waveform as a neon trace. It is " +
          'presentational and decorative: hidden from assistive technology and never focusable. ' +
          'It hands its canvas to the shared renderer, which draws it off the main thread from ' +
          'the feed its `bank` receives; the component knows nothing about decks. `voice` picks ' +
          'the trace colour from `--synth-wave-1`, `--synth-wave-2` or `--synth-wave-3`. `state` ' +
          'poses the window apart from its bank (playing, held on its last picture, or a flat ' +
          "line); left `null`, the window follows the bank's own state. Until the renderer " +
          'draws, or if it cannot, the window shows empty glass. Every story here is fed by a ' +
          'small driver through the real feed pipeline: a kick on voice 1, an arpeggio on voice ' +
          '2 and a sustained pad on voice 3.',
      },
    },
  },
  argTypes: {
    bank: {
      description:
        'Opaque id tying the window to a fed bank. The stories give each render its own bank.',
      control: false,
    },
    voice: {
      description:
        "Which of the bank's three voices (0, 1 or 2) the window shows; it selects the trace colour.",
      control: false,
    },
    state: {
      description:
        "Poses the window apart from its bank: `playing`, `held` or `flat`. `null` follows the bank's state.",
      control: 'select',
      options: [null, 'playing', 'held', 'flat'],
    },
  },
};

export default meta;
type Story = StoryObj<VoiceWaveComponent>;

/** Three windows, one per voice, over a driver feeding their bank. */
const rack = (waveform: number, stateExpression: string, driverInputs = '') => `
  <div style="display: flex; flex-direction: column; gap: 6px; width: 320px; padding: 8px; background: var(--synth-face);">
    <lib-voice-wave [bank]="bank" [voice]="0" [state]="${stateExpression}" />
    <lib-voice-wave [bank]="bank" [voice]="1" [state]="${stateExpression}" />
    <lib-voice-wave [bank]="bank" [voice]="2" [state]="${stateExpression}" />
    <lib-wave-feed-driver [bank]="bank" [waveform]="${waveform}" ${driverInputs} />
  </div>`;

const renderWith =
  (waveform: number, driverInputs = ''): Story['render'] =>
  (args) => ({
    props: { state: args.state ?? null, bank: freshBank() },
    template: rack(waveform, 'state', driverInputs),
  });

/** Follows the bank's own state, which the driver keeps playing: voice 1 magenta, voice 2 cyan, voice 3 yellow. */
export const Playing: Story = { args: { state: null }, render: renderWith(TRIANGLE_AND_PULSE) };

/** Plays, then freezes on its last picture at the first moment all three voices are sounding. */
export const Held: Story = {
  render: () => {
    const state = signal<WaveWindowState | null>(null);
    return {
      props: { state, bank: freshBank(), hold: () => state.set('held') },
      template: rack(TRIANGLE_AND_PULSE, 'state()', '(peak)="hold()"'),
    };
  },
};

/** A flat line on all three voices, although the bank is playing. */
export const Flat: Story = { args: { state: 'flat' }, render: renderWith(TRIANGLE_AND_PULSE) };

export const Triangle: Story = { args: { state: null }, render: renderWith(WAVEFORM_TRIANGLE) };

export const Sawtooth: Story = { args: { state: null }, render: renderWith(WAVEFORM_SAWTOOTH) };

export const Pulse: Story = { args: { state: null }, render: renderWith(WAVEFORM_PULSE) };

export const Noise: Story = { args: { state: null }, render: renderWith(WAVEFORM_NOISE) };

/** Triangle with ring modulation from the neighbouring voice: the wave inverts in alternate halves of the source's cycle. */
export const RingModulation: Story = {
  args: { state: null },
  render: renderWith(WAVEFORM_TRIANGLE, '[ring]="true"'),
};

/** Sawtooth hard-synced to the neighbouring voice: the wave restarts on every source cycle. */
export const HardSync: Story = {
  args: { state: null },
  render: renderWith(WAVEFORM_SAWTOOTH, '[sync]="true"'),
};
