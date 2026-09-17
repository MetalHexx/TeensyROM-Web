import { Injectable, inject } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import { createSidPlayer, parseSidFile, frames, clamp } from '@sidablist/core';
import type { SidPlayer, PlayerSnapshot, Frames, FrameClock, ReplayRunner } from '@sidablist/core';
import { createAsidSink } from '@sidablist/asid';
import type { AsidSink, MidiOutputPort } from '@sidablist/asid';
import type { Playable } from '@sidablist/tunes';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS } from './ports';
import type { Slot } from './slot';

/** One deck slot's whole engine bundle: the core player, its ASID sink, the audio-graph clock
 *  driving it and the replay thread it jumps through. */
export interface SlotRuntime {
  readonly player: SidPlayer;
  readonly sink: AsidSink;
  readonly clock: FrameClock;
  readonly replay: ReplayRunner;
}

/** The façade's mutable target: which port id a slot currently points at, and whether the
 *  "nothing bound" warning has already fired for the unbound stretch in progress. */
interface FacadeState {
  portId: string | null;
  warned: boolean;
}

/**
 * Owns one engine bundle per deck slot — built once, torn down once — and the MIDI port façade
 * each bundle's sink sends through. Lifted from the POC's `DeckHostComponent` providers and
 * `DeckMidiBinding.createOutputPort`, collapsed onto two slots instead of one deck host per
 * component instance.
 *
 * `build` creates no `AudioContext`: the clock's graph starts on the first `play`, inside the
 * factory-supplied `FrameClock`'s own `start()` — never here.
 */
@Injectable({ providedIn: 'root' })
export class DeckRuntime {
  private readonly clockFactory = inject(FRAME_CLOCK_FACTORY);
  private readonly replayFactory = inject(REPLAY_RUNNER_FACTORY);
  private readonly midiAccess = inject(MIDI_ACCESS);

  private readonly slots = new Map<Slot, SlotRuntime>();
  private readonly facades = new Map<Slot, FacadeState>();

  /** Builds this slot's engine bundle, once. A second call is a no-op — the sink, the player, the
   *  clock and the replay thread are never rebuilt for a slot already built. */
  build(slot: Slot): void {
    if (this.slots.has(slot)) {
      return;
    }

    const facade: FacadeState = { portId: null, warned: false };
    this.facades.set(slot, facade);

    const port = this.createOutputPort(slot, facade);
    const sink = createAsidSink(port);
    const clock = this.clockFactory();
    const replay = this.replayFactory();
    const player = createSidPlayer({ sink, clock, replayRunner: replay });

    this.slots.set(slot, { player, sink, clock, replay });
  }

  /** Re-targets this slot's port façade. The sink and player are never rebuilt — only the id the
   *  façade resolves against on the next send changes. Resets the unbound-stretch warning so an
   *  unbound slot warns again the next time it drops bytes. */
  setPort(slot: Slot, portId: string | null): void {
    const facade = this.requireFacade(slot);
    facade.portId = portId;
    facade.warned = false;
  }

  /** Hands a resolved tune to this slot's player: loads it, selects its subtune, and lands
   *  whatever structure the tune's index carries. */
  load(slot: Slot, playable: Playable): void {
    const { player } = this.requireSlot(slot);
    player.loadTune(parseSidFile(playable.bytes));
    player.selectSubtune(playable.reference.identity.subtune);

    const { index } = playable;
    player.setTrackStructure({
      loopStartFrame: index.loopStartFrame === null ? null : frames(index.loopStartFrame),
      loopPeriodFrames: index.loopPeriodFrames === null ? null : frames(index.loopPeriodFrames),
      endedAtFrame: index.endedAtFrame === null ? null : frames(index.endedAtFrame),
    });
  }

  play(slot: Slot): Promise<void> {
    return this.requireSlot(slot).player.play();
  }

  pause(slot: Slot): void {
    this.requireSlot(slot).player.pause();
  }

  stop(slot: Slot): void {
    this.requireSlot(slot).player.stop();
  }

  setRepeat(slot: Slot, on: boolean): void {
    this.requireSlot(slot).player.setRepeatTrack(on);
  }

  /** `scrubToPercent`'s basis rule, moved here: the percentage is measured against the snapshot's
   *  own position basis, not against a fixed length, and markers are dropped — core's `frames`
   *  and `clamp` live here, not in the service. */
  seekToPercent(slot: Slot, percent: number): Promise<void> {
    const { player } = this.requireSlot(slot);
    const basis = player.getSnapshot().basis.positionBasisFrames;
    return player.seek(frames(Math.round((clamp(percent, 0, 100) / 100) * basis)));
  }

  snapshot(slot: Slot): PlayerSnapshot {
    return this.requireSlot(slot).player.getSnapshot();
  }

  position(slot: Slot): Frames {
    return this.requireSlot(slot).player.getPosition();
  }

  subscribe(slot: Slot, listener: () => void): () => void {
    return this.requireSlot(slot).player.subscribe(listener);
  }

  identify(slot: Slot, text: string): void {
    this.requireSlot(slot).sink.showText(text);
  }

  /** Disposes this slot's player. Nothing else holds the clock's audio graph, the ASID session or
   *  the replay thread — a player left running keeps streaming frames with no UI left to reach
   *  `stop()`. */
  dispose(slot: Slot): void {
    this.requireSlot(slot).player.dispose();
  }

  /**
   * The POC's `createOutputPort`, with the output-identity wrap removed: `IMidiAccess.outputPortFor`
   * already memoises on the underlying output's identity, so this façade only needs to re-resolve
   * the id per call, not re-wrap it. Nothing bound drops the bytes and warns once per unbound
   * stretch, not per send — production plays a dropped tune whether or not a port is bound, and a
   * per-call warning would fire fifty times a second.
   */
  private createOutputPort(slot: Slot, facade: FacadeState): MidiOutputPort {
    const resolve = (): MidiOutputPort | null =>
      facade.portId === null ? null : this.midiAccess.outputPortFor(facade.portId);

    return {
      get portId(): string | null {
        return facade.portId;
      },
      get supportsCancel(): boolean {
        return resolve()?.supportsCancel ?? false;
      },
      send: (bytes: Uint8Array, timestampMs?: number): void => {
        const resolved = resolve();
        if (resolved === null) {
          if (!facade.warned) {
            facade.warned = true;
            logWarn(`DeckRuntime: slot ${slot} has no MIDI port bound — dropping bytes.`);
          }
          return;
        }
        resolved.send(bytes, timestampMs);
      },
      cancelPending: (): boolean => resolve()?.cancelPending() ?? false,
    };
  }

  private requireSlot(slot: Slot): SlotRuntime {
    const entry = this.slots.get(slot);
    if (entry === undefined) {
      throw new Error(`DeckRuntime: slot ${slot} has not been built`);
    }
    return entry;
  }

  private requireFacade(slot: Slot): FacadeState {
    const facade = this.facades.get(slot);
    if (facade === undefined) {
      throw new Error(`DeckRuntime: slot ${slot} has not been built`);
    }
    return facade;
  }
}
