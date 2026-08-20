import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { SidFile, SidParseError } from '../sid/sid-file.model';
import { parseSidFile } from '../sid/sid-file.parser';
import { BUNDLED_TUNES, decodeBundledTune } from '../sid/bundled';
import { MidiOutputService } from '../midi/midi-output.service';
import { ScriptProcessorFrameClock } from '../clock/frame-clock';
import {
  DjPlayerEngine,
  FRAME_CLOCK,
  MAX_SPEED_MULTIPLIER,
  MIN_SPEED_MULTIPLIER,
  NOMINAL_INTERVAL_OPTIONS_US,
  SpeedMode,
} from '../engine/dj-player-engine';

/** A tune the Tune section can offer as a button — bundled, or opened from disk this session. */
interface TuneSource {
  readonly id: string;
  readonly label: string;
  readonly getBytes: () => Uint8Array;
}

const MICROSECONDS_PER_SECOND = 1_000_000;

/** off / 5 ms / 20 ms — the schedule-ahead choices this experiment needs to answer whether a
 * timestamped `send()` is honoured at all in this browser. */
const SCHEDULE_AHEAD_OPTIONS_MS: readonly number[] = [0, 5, 20];

/** The three timer modes the cartridge's own ASID player menu offers — the browser never sets
 * this, it only records which one the tester configured before a session. */
export type TimerMode = 'off' | 'auto-seed' | 'fixed-50hz';

const TIMER_MODE_OPTIONS: readonly { readonly value: TimerMode; readonly label: string }[] = [
  { value: 'off', label: 'off' },
  { value: 'auto-seed', label: 'auto-seed' },
  { value: 'fixed-50hz', label: 'fixed 50 Hz' },
];

/** The six buffer sizes the cartridge's own menu offers — likewise a record, not a command. */
export type BufferSize = 'tiny' | 'small' | 'medium' | 'large' | 'xl' | 'xxl';

const BUFFER_SIZE_OPTIONS: readonly { readonly value: BufferSize; readonly label: string }[] = [
  { value: 'tiny', label: 'Tiny (256 B)' },
  { value: 'small', label: 'Small (512 B)' },
  { value: 'medium', label: 'Medium (1024 B)' },
  { value: 'large', label: 'Large (2048 B)' },
  { value: 'xl', label: 'XL (4096 B)' },
  { value: 'xxl', label: 'XXL (8192 B)' },
];

/**
 * The DJ player control panel — reachable only by typing `/dev/dj-poc` in the browser. One column
 * of labelled control groups: MIDI, Timing, Tune, Transport, Speed, Voice, Cues, Loop/Scrub,
 * Diagnostics.
 */
@Component({
  selector: 'lib-dj-poc-view',
  templateUrl: './dj-poc-view.component.html',
  styleUrl: './dj-poc-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Provided here rather than root: this is a quarantined POC surface and neither its
  // permission-holding service nor its audio graph should register in the app injector.
  providers: [
    MidiOutputService,
    DjPlayerEngine,
    { provide: FRAME_CLOCK, useFactory: () => new ScriptProcessorFrameClock() },
  ],
})
export class DjPocViewComponent {
  // This route bypasses LayoutComponent, the only place ThemeService is normally injected —
  // without this, ThemeService never constructs and the app's dark-mode class never applies.
  private readonly themeService = inject(ThemeService);

  private readonly midiService = inject(MidiOutputService);
  protected readonly midiAccessState = this.midiService.accessState;
  protected readonly midiPorts = this.midiService.ports;
  protected readonly selectedMidiPortId = this.midiService.selectedPortId;
  protected readonly midiError = this.midiService.lastError;

  // Web MIDI enumerates zero ports for a granted-but-empty session (no cartridge attached, or the
  // OS hasn't surfaced it yet) without the service itself treating that as an error.
  protected readonly noPortsFoundError = computed<string | null>(() =>
    this.midiAccessState() === 'granted' && this.midiPorts().length === 0
      ? 'MIDI access was granted, but no output ports were found. Connect the cartridge and re-enable MIDI.'
      : null
  );

  private readonly engine = inject(DjPlayerEngine);
  protected readonly engineState = this.engine.state;
  protected readonly engineError = this.engine.lastError;
  protected readonly engineStats = this.engine.stats;
  protected readonly currentSubtune = this.engine.currentSubtune;
  protected readonly subtuneCount = this.engine.subtuneCount;
  protected readonly speedMultiplier = this.engine.speedMultiplier;
  protected readonly speedMode = this.engine.speedMode;
  protected readonly recipeEnabled = this.engine.recipeEnabled;
  protected readonly nominalIntervalUs = this.engine.nominalIntervalUs;
  protected readonly scheduleAheadMs = this.engine.scheduleAheadMs;
  protected readonly mutedVoices = this.engine.mutedVoices;
  protected readonly cueFrames = this.engine.cueFrames;
  protected readonly loopInPercent = this.engine.loopInPercent;
  protected readonly loopOutPercent = this.engine.loopOutPercent;
  protected readonly loopEnabled = this.engine.loopEnabled;

  protected readonly minSpeed = MIN_SPEED_MULTIPLIER;
  protected readonly maxSpeed = MAX_SPEED_MULTIPLIER;
  protected readonly scheduleAheadOptionsMs = SCHEDULE_AHEAD_OPTIONS_MS;
  protected readonly voiceIndices: readonly number[] = [0, 1, 2];
  protected readonly cueIndices: readonly number[] = [0, 1, 2, 3];

  // The scrub slider's own displayed position — deliberately not sourced from the engine, which
  // exposes no continuous playback-position signal. Updated on every drag tick; the engine only
  // hears about it once the drag releases (see onScrubChange).
  protected readonly scrubDisplayPercent = signal<number>(0);

  // Neither the timer mode nor the buffer size is part of the ASID protocol this browser speaks —
  // the cartridge decides both on its own, in its own menu. These signals record what the tester
  // set there so the diagnostics readout and the findings log can attribute a session to the
  // right one of the eighteen timer-mode x buffer-size combinations under test.
  protected readonly timerMode = signal<TimerMode>('off');
  protected readonly bufferSize = signal<BufferSize>('tiny');
  protected readonly timerModeOptions = TIMER_MODE_OPTIONS;
  protected readonly bufferSizeOptions = BUFFER_SIZE_OPTIONS;
  protected readonly timerModeLabel = computed(
    () => TIMER_MODE_OPTIONS.find((option) => option.value === this.timerMode())?.label ?? ''
  );
  protected readonly bufferSizeLabel = computed(
    () => BUFFER_SIZE_OPTIONS.find((option) => option.value === this.bufferSize())?.label ?? ''
  );

  // Identify interrupts the stream on the cartridge, so it stays out of reach while a tune plays.
  protected readonly canIdentify = computed(
    () =>
      this.midiAccessState() === 'granted' &&
      this.selectedMidiPortId() !== null &&
      this.engineState() !== 'playing'
  );
  protected readonly canPlay = computed(
    () =>
      this.currentTune() !== null &&
      this.selectedMidiPortId() !== null &&
      this.engineState() !== 'playing'
  );
  protected readonly canStepSubtune = computed(
    () => this.currentTune() !== null && this.subtuneCount() > 1
  );

  /** An NTSC tune loads an interval of its own, so the selector has to be able to show it. */
  protected readonly intervalOptions = computed<readonly number[]>(() => {
    const current = this.nominalIntervalUs();
    return NOMINAL_INTERVAL_OPTIONS_US.includes(current)
      ? NOMINAL_INTERVAL_OPTIONS_US
      : [current, ...NOMINAL_INTERVAL_OPTIONS_US];
  });

  // One SID-data packet goes out per clock tick, so the clock's own measured tick rate is the
  // frame-packet rate; the occasional Start/Stop/Identify control packet is noise against it.
  protected readonly packetsPerSecond = computed(() => {
    const intervalUs = this.engineStats().measuredMeanIntervalUs;
    return intervalUs > 0 ? MICROSECONDS_PER_SECOND / intervalUs : 0;
  });
  protected readonly bytesPerSecond = computed(() => {
    const stats = this.engineStats();
    return stats.packetsSent > 0 ? this.packetsPerSecond() * (stats.bytesSent / stats.packetsSent) : 0;
  });

  private readonly bundledSources: readonly TuneSource[] = BUNDLED_TUNES.map((tune) => ({
    id: tune.id,
    label: tune.label,
    getBytes: () => decodeBundledTune(tune.base64),
  }));

  // Tunes opened from disk join the bundled buttons for the rest of the session rather than
  // replacing the file picker's value — a listening session runs for hours.
  private readonly diskSources = signal<readonly TuneSource[]>([]);
  private diskTuneCount = 0;

  readonly availableTunes = computed<readonly TuneSource[]>(() => [...this.bundledSources, ...this.diskSources()]);
  readonly currentTune = signal<SidFile | null>(null);
  readonly tuneError = signal<string | null>(null);

  selectTune(source: TuneSource): void {
    try {
      this.loadTune(parseSidFile(source.getBytes()));
    } catch (error) {
      this.currentTune.set(null);
      this.tuneError.set(describeParseError(error));
    }
  }

  async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // allow re-picking the same file later in the session
    if (!file) {
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    try {
      const parsed = parseSidFile(bytes);
      const source: TuneSource = {
        id: `disk-${this.diskTuneCount++}-${file.name}`,
        label: file.name,
        getBytes: () => bytes,
      };
      this.diskSources.update((sources) => [...sources, source]);
      this.loadTune(parsed);
    } catch (error) {
      this.currentTune.set(null);
      this.tuneError.set(describeParseError(error));
    }
  }

  onEnableMidi(): void {
    void this.midiService.requestAccess();
  }

  onSelectMidiPort(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.midiService.selectPort(select.value);
  }

  onIdentify(): void {
    const ports = this.midiPorts();
    const index = ports.findIndex((port) => port.id === this.selectedMidiPortId());
    const label = index === -1 ? 'ASID-DJ-0 PORT ?' : `ASID-DJ-0 PORT ${index + 1}`;
    this.midiService.identify(label);
  }

  onPlay(): void {
    void this.engine.play();
  }

  onPause(): void {
    this.engine.pause();
  }

  onStop(): void {
    this.engine.stop();
  }

  onPreviousSubtune(): void {
    this.engine.previousSubtune();
  }

  onNextSubtune(): void {
    this.engine.nextSubtune();
  }

  onSpeedInput(event: Event): void {
    this.engine.setSpeed(Number((event.target as HTMLInputElement).value));
  }

  onSpeedModeChange(event: Event): void {
    this.engine.setSpeedMode((event.target as HTMLSelectElement).value as SpeedMode);
  }

  onRecipeToggle(event: Event): void {
    this.engine.setRecipeEnabled((event.target as HTMLInputElement).checked);
  }

  onNominalIntervalChange(event: Event): void {
    this.engine.setNominalIntervalUs(Number((event.target as HTMLSelectElement).value));
  }

  onScheduleAheadChange(event: Event): void {
    this.engine.setScheduleAhead(Number((event.target as HTMLSelectElement).value));
  }

  onVoiceMuteToggle(voice: number, event: Event): void {
    this.engine.setVoiceMuted(voice, (event.target as HTMLInputElement).checked);
  }

  onAddCue(slot: number): void {
    this.engine.addCue(slot);
  }

  onHopToCue(slot: number): void {
    this.engine.hopToCue(slot);
  }

  onLoopInInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.engine.setLoopRange(Math.min(value, this.loopOutPercent() - 1), this.loopOutPercent());
  }

  onLoopOutInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.engine.setLoopRange(this.loopInPercent(), Math.max(value, this.loopInPercent() + 1));
  }

  onLoopEnabledToggle(event: Event): void {
    this.engine.setLoopEnabled((event.target as HTMLInputElement).checked);
  }

  onScrubInput(event: Event): void {
    this.scrubDisplayPercent.set(Number((event.target as HTMLInputElement).value));
  }

  // (change) fires on release, not on every drag tick — the seam that makes this "drag anywhere,
  // release, and it jumps" rather than a continuous scrub.
  onScrubChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.scrubDisplayPercent.set(value);
    this.engine.scrubTo(value);
  }

  onTimerModeChange(event: Event): void {
    this.timerMode.set((event.target as HTMLSelectElement).value as TimerMode);
  }

  onBufferSizeChange(event: Event): void {
    this.bufferSize.set((event.target as HTMLSelectElement).value as BufferSize);
  }

  protected frameRateHz(intervalUs: number): string {
    return (MICROSECONDS_PER_SECOND / intervalUs).toFixed(3);
  }

  private loadTune(file: SidFile): void {
    this.currentTune.set(file);
    this.tuneError.set(null);
    this.engine.loadTune(file);
    // play() already no-ops into the engine's "no MIDI output port selected" error path when no
    // port is chosen, so no separate guard is needed here.
    void this.engine.play();
  }
}

function describeParseError(error: unknown): string {
  return error instanceof SidParseError ? error.message : 'Failed to parse SID file.';
}
