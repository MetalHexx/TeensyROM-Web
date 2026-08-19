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

/** What the schedule-ahead toggle asks for when it is on — roughly one frame of lookahead. */
const SCHEDULE_AHEAD_MS = 20;

/**
 * Throwaway spike for the ASID DJ player — reachable only by typing `/dev/dj-poc` in the browser.
 * Each later phase fills in one of the placeholder sections below.
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

  protected readonly minSpeed = MIN_SPEED_MULTIPLIER;
  protected readonly maxSpeed = MAX_SPEED_MULTIPLIER;
  protected readonly scheduleAheadStep = SCHEDULE_AHEAD_MS;

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

  /** An NTSC tune loads an interval of its own, so the selector has to be able to show it. */
  protected readonly intervalOptions = computed<readonly number[]>(() => {
    const current = this.nominalIntervalUs();
    return NOMINAL_INTERVAL_OPTIONS_US.includes(current)
      ? NOMINAL_INTERVAL_OPTIONS_US
      : [current, ...NOMINAL_INTERVAL_OPTIONS_US];
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

  onScheduleAheadToggle(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.engine.setScheduleAhead(on ? SCHEDULE_AHEAD_MS : 0);
  }

  protected frameRateHz(intervalUs: number): string {
    return (MICROSECONDS_PER_SECOND / intervalUs).toFixed(3);
  }

  private loadTune(file: SidFile): void {
    this.currentTune.set(file);
    this.tuneError.set(null);
    this.engine.loadTune(file);
  }
}

function describeParseError(error: unknown): string {
  return error instanceof SidParseError ? error.message : 'Failed to parse SID file.';
}
