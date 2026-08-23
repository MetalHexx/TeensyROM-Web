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
  protected readonly heldVoices = this.engine.heldVoices;
  protected readonly effectiveMutes = this.engine.effectiveMutes;
  protected readonly cues = this.engine.cues;
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

  // The cartridge's frame timer, stated rather than recorded: we know it is on once we have sent a
  // recipe packet, because the firmware's handler forces `FrameTimerMode = true` on receipt.
  //
  // Buffer size has no equivalent and is deliberately absent. ASID is one-way host -> cartridge and
  // Identify writes text to the C64 screen rather than querying it, so this browser has no way to
  // read the buffer size back. A hand-kept record of it is only true while someone remembers to
  // update two places at once, and a stale one is worse than nothing — the C64's own menu already
  // displays the buffer size accurately, so that is where it is read.
  protected readonly frameTimerForced = this.engine.recipeSent;
  protected readonly frameTimerStatus = computed(() =>
    this.frameTimerForced()
      ? `on — forced by the recipe packet at ${Math.round(this.engineStats().effectiveIntervalUs)} µs`
      : 'not set by this browser — the cartridge keeps whatever it last had'
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

  /** Pointer capture keeps the release on this element even if the press drags off it — without it
   * the browser fires no `pointerup` here and the voice stays inverted. */
  onVoiceHoldStart(voice: number, event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.engine.setVoiceHeld(voice, true);
  }

  /** Handles both `pointerup` and `pointercancel` — either way the hold ends. */
  onVoiceHoldEnd(voice: number): void {
    this.engine.setVoiceHeld(voice, false);
  }

  onClearVoiceMutes(): void {
    this.engine.clearVoiceMutes();
  }

  onAddCue(slot: number): void {
    this.engine.addCue(slot);
  }

  onHopToCue(slot: number): void {
    this.engine.hopToCue(slot);
  }

  onClearCue(slot: number): void {
    this.engine.clearCue(slot);
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
