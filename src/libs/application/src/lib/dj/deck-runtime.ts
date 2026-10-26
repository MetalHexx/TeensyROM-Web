import { Injectable, inject } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import { createSidPlayer, parseSidFile, frames, clamp, playCallIntervalUs } from '@sidablist/core';
import type {
  SidPlayer,
  PlayerSnapshot,
  Frames,
  FrameClock,
  ReplayRunner,
  JumpSettings,
  SidField,
  SidModel,
} from '@sidablist/core';
import { createAsidSink } from '@sidablist/asid';
import type { AsidSink, MidiOutputPort } from '@sidablist/asid';
import type { Playable } from '@sidablist/tunes';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS } from './ports';
import type { Slot } from './slot';

/** One deck slot's whole engine bundle: the core player, its ASID sink, the audio-graph clock
 *  driving it and the two replay threads it uses — one for jumps, one for prepared builds. */
export interface SlotRuntime {
  readonly player: SidPlayer;
  readonly sink: AsidSink;
  readonly clock: FrameClock;
  readonly replay: ReplayRunner;
  readonly prepare: ReplayRunner;
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
  /** The chip model of the tune each slot last loaded — what `resync` hands the sink's `begin`. */
  private readonly chipModels = new Map<Slot, SidModel>();

  /** Builds this slot's engine bundle, once. A second call is a no-op — the sink, the player, the
   *  clock and the replay threads are never rebuilt for a slot already built. */
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
    const prepare = this.replayFactory();
    const player = createSidPlayer({ sink, clock, replayRunner: replay, prepareRunner: prepare });

    this.slots.set(slot, { player, sink, clock, replay, prepare });
  }

  /** Re-targets this slot's port façade. The sink and player are never rebuilt — only the id the
   *  façade resolves against on the next send changes. Resets the unbound-stretch warning so an
   *  unbound slot warns again the next time it drops bytes. */
  setPort(slot: Slot, portId: string | null): void {
    const facade = this.requireFacade(slot);
    facade.portId = portId;
    facade.warned = false;
  }

  /** Re-sends the ASID start handshake — SID type, then start — to this slot's cartridge. A
   *  cartridge that went away was power-cycled and missed the one `begin` a tune sends when it
   *  starts, so it must hear it again once its port returns. Does nothing with no tune loaded. */
  resync(slot: Slot): void {
    const { sink } = this.requireSlot(slot);
    const chipModel = this.chipModels.get(slot);
    if (chipModel !== undefined) {
      sink.begin({ chipModel });
    }
  }

  /** Hands a resolved tune to this slot's player: loads it, selects its subtune, and lands
   *  whatever structure the tune's index carries. */
  load(slot: Slot, playable: Playable): void {
    const { player } = this.requireSlot(slot);
    const file = parseSidFile(playable.bytes);
    player.loadTune(file);
    this.chipModels.set(slot, file.model);
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

  /** Voice 0…2's pitch multiplier — composes with the clock correction in the library. */
  setVoicePitch(slot: Slot, voice: number, multiplier: number): void {
    this.requireSlot(slot).player.setVoicePitch(voice, multiplier);
  }

  /** A signed offset in the field's own units; 0 clears it. */
  setFieldOffset(slot: Slot, field: SidField, amount: number): void {
    const { player } = this.requireSlot(slot);
    if (amount === 0) {
      player.clearFieldOffset(field);
    } else {
      player.setFieldOffset(field, amount);
    }
  }

  /** Holds a field at `value` on this slot's engine — see `SidPlayer.holdField`. */
  holdField(slot: Slot, field: SidField, value: number): void {
    this.requireSlot(slot).player.holdField(field, value);
  }

  /** Releases a field held by `holdField`; releasing one that is not held does nothing. */
  releaseField(slot: Slot, field: SidField): void {
    this.requireSlot(slot).player.releaseField(field);
  }

  /** The registers as written and as sent, into caller-owned buffers — allocates nothing. */
  readRegisters(slot: Slot, written: Uint8Array, sent: Uint8Array): void {
    this.requireSlot(slot).player.readRegisters(written, sent);
  }

  /** Sets this slot's tempo multiplier (1 = the tune's own speed). */
  setTempo(slot: Slot, multiplier: number): void {
    this.requireSlot(slot).player.setTempo(multiplier);
  }

  /** Latches a voice's mute (voice 0…2). */
  setVoiceMuted(slot: Slot, voice: number, muted: boolean): void {
    this.requireSlot(slot).player.setVoiceMuted(voice, muted);
  }

  /** Momentarily holds a voice (voice 0…2). */
  setVoiceHeld(slot: Slot, voice: number, held: boolean): void {
    this.requireSlot(slot).player.setVoiceHeld(voice, held);
  }

  /** Clears every latched voice mute; holds are untouched. */
  clearVoiceMutes(slot: Slot): void {
    this.requireSlot(slot).player.clearVoiceMutes();
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

  /** Microseconds per play call for this slot's loaded tune — what converts a position in play
   *  calls to time. */
  playCallIntervalUs(slot: Slot): number {
    const { nominalIntervalUs, rate } = this.snapshot(slot).tempo;
    return playCallIntervalUs(nominalIntervalUs, rate);
  }

  position(slot: Slot): Frames {
    return this.requireSlot(slot).player.getPosition();
  }

  /** Declares the frames this slot may jump to instantly, replacing the previous set; the engine
   *  prepares each off the main thread and publishes readiness in its snapshot. The engine clears
   *  the set on a tune load and a subtune change. */
  setJumpTargets(slot: Slot, targetFrames: readonly number[]): void {
    this.requireSlot(slot).player.setJumpTargets(targetFrames.map((frame) => frames(frame)));
  }

  /** Captures the live position into the engine's image cache and returns its frame, or null with
   *  nothing loaded. A declared frame is ready the moment this returns. */
  capturePosition(slot: Slot): number | null {
    return this.requireSlot(slot).player.capturePosition();
  }

  /** Runs a loop between two frames; null stops looping. */
  setActiveLoop(slot: Slot, loop: { startFrame: number; endFrame: number } | null): void {
    this.requireSlot(slot).player.setActiveLoop(
      loop === null
        ? null
        : { startFrame: frames(loop.startFrame), endFrame: frames(loop.endFrame) }
    );
  }

  /** Queues a jump for the end of the running loop's lap; null cancels. Its `settings` land with
   *  the jump. */
  queueJump(
    slot: Slot,
    target: { startFrame: number; endFrame: number | null; settings?: JumpSettings } | null
  ): void {
    this.requireSlot(slot).player.queueJump(
      target === null
        ? null
        : {
            startFrame: frames(target.startFrame),
            endFrame: target.endFrame === null ? null : frames(target.endFrame),
            ...(target.settings === undefined ? {} : { settings: target.settings }),
          }
    );
  }

  /** Seeks to `frame`; any `settings` land with the jump. */
  seekToFrame(slot: Slot, frame: number, settings?: JumpSettings): Promise<void> {
    const { player } = this.requireSlot(slot);
    return settings === undefined
      ? player.seek(frames(frame))
      : player.seek(frames(frame), settings);
  }

  subscribe(slot: Slot, listener: () => void): () => void {
    return this.requireSlot(slot).player.subscribe(listener);
  }

  identify(slot: Slot, text: string): void {
    this.requireSlot(slot).sink.showText(text);
  }

  /** Disposes this slot's player, which releases both replay threads. Nothing else holds the
   *  clock's audio graph, the ASID session or the threads — a player left running keeps streaming
   *  frames with no UI left to reach `stop()`. */
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
