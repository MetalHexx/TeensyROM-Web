import {
  Injectable,
  Injector,
  computed,
  effect,
  inject,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { ALERT_SERVICE, midiPortDeviceToken, type IAlertService } from '@teensyrom-nx/domain';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { MidiSettingsPersistence } from '../midi-settings-persistence';
import {
  MIDI_ACCESS,
  MIDI_INPUT,
  type IMidiAccess,
  type IMidiInput,
  type MidiInputOpenResult,
  type MidiInputPort,
} from '../ports';
import type { KnownController } from './mapping.models';
import { MidiMappingEngine } from './midi-mapping-engine';
import { MidiMappings } from './midi-mappings';
import { MidiMappingStore, type ControllerStatus } from './midi-mapping-store';

/** The server rejects a longer controller name, and an empty one. */
const MAX_CONTROLLER_NAME_LENGTH = 128;
const UNNAMED_INPUT = 'Unnamed input';

/** What a port name becomes as a controller's name; a controller is found again by comparing it
 *  with the same rule. */
function controllerName(portName: string): string {
  const name = portName.trim().slice(0, MAX_CONTROLLER_NAME_LENGTH).trim();
  return name === '' ? UNNAMED_INPUT : name;
}

/** A cartridge's own input is never a controller. */
function isControllerPort(port: MidiInputPort): boolean {
  return midiPortDeviceToken(port.name) === null;
}

type AlertStatus = Extract<ControllerStatus, 'unavailable' | 'missing' | 'unmatched'>;

function isAlertStatus(status: ControllerStatus | undefined): status is AlertStatus {
  return status === 'unavailable' || status === 'missing' || status === 'unmatched';
}

function alertText(name: string, status: AlertStatus): string {
  switch (status) {
    case 'unavailable':
      return `MIDI controller "${name}" could not be opened. Another application, such as a DAW, may be using it. Its mappings are kept; switch its listening off and on to retry.`;
    case 'missing':
      return `MIDI controller "${name}" is not connected. Its mappings are kept and work again when it returns.`;
    case 'unmatched':
      return `MIDI controller "${name}" matches more than one port. Choose its port in the Bindings panel.`;
  }
}

/** The port a known controller resolved to, or why it has none. */
interface Resolution {
  readonly portId: string | null;
  /** Two or more connected inputs carry its name and none is its saved port. */
  readonly unmatched: boolean;
}

/**
 * Owns the controllers' input ports, their runtime state and the alerts about them.
 *
 * A saved controller is re-found by its last port id, then by a unique port name. The ports held
 * open follow one policy: only controllers that are listening and have mappings, except while
 * mapping mode is on, when every input that is not a cartridge opens so learn can hear it. A
 * controller that is held by another application, missing or ambiguous keeps its mappings and
 * raises one alert per occurrence. Leaving `listening` lets go of any hold the controller drove.
 */
@Injectable({ providedIn: 'root' })
export class MidiControllers {
  private readonly store = inject(MidiMappingStore);
  private readonly mappings = inject(MidiMappings);
  private readonly engine = inject(MidiMappingEngine);
  private readonly persistence = inject(MidiSettingsPersistence);
  private readonly midiInput: IMidiInput = inject(MIDI_INPUT);
  private readonly midiAccess: IMidiAccess = inject(MIDI_ACCESS);
  private readonly alertService: IAlertService = inject(ALERT_SERVICE);
  private readonly injector = inject(Injector);

  /** The connected inputs a controller can be chosen from. */
  readonly connectedInputs = computed(() =>
    this.midiInput
      .inputs()
      .filter((port) => port.connected && isControllerPort(port))
      .map(({ id, name }) => ({ id, name }))
  );

  private readonly controllerByPort = computed(() => {
    const known = new Set(this.store.controllers().map((controller) => controller.id));
    const byPort = new Map<string, string>();
    for (const [id, portId] of Object.entries(this.store.controllerPorts())) {
      if (portId !== null && known.has(id)) {
        byPort.set(portId, id);
      }
    }
    return byPort;
  });

  /** The ports this class has opened and not yet released. */
  private readonly held = new Set<string>();
  private effectInstalled = false;
  private draining: Promise<void> | null = null;
  private rerun = false;
  /** Counts policy requests; a run whose count has moved on by the time its opens settle has
   *  stale results, and the run that follows it replaces them. */
  private generation = 0;

  /** Loads the saved controllers and mappings, then installs, once, the effect that keeps the
   *  ports and statuses in step with MIDI access, the inputs, mapping mode, controllers and
   *  mappings. */
  async hydrate(): Promise<void> {
    await this.mappings.hydrate();
    if (this.effectInstalled) {
      return;
    }
    this.effectInstalled = true;

    runInInjectionContext(this.injector, () => {
      effect(() => {
        this.midiAccess.accessState();
        this.midiInput.inputs();
        this.store.mappingMode();
        this.store.controllers();
        this.store.mappings();
        untracked(() => void this.applyPolicy());
      });
    });
  }

  /**
   * Resolves each controller's port, opens and closes ports to match, and sets each controller's
   * status. Runs one at a time: a request made during a run runs once more after it. Resolves
   * when the latest request has been applied.
   */
  applyPolicy(): Promise<void> {
    this.generation++;
    if (this.draining !== null) {
      this.rerun = true;
      return this.draining;
    }
    this.draining = this.drain();
    return this.draining;
  }

  /** Switches whether a controller's mappings listen. Off lets go of its port and keeps them. */
  setListening(controllerId: string, on: boolean): void {
    const controller = this.known(controllerId);
    if (controller === null || controller.listening === on) {
      return;
    }
    this.store.upsertController({ controller: { ...controller, listening: on } });
    this.persistence.scheduleSave();
  }

  /** Chooses the input a controller listens to, which brings back every mapping on it. */
  pointAt(controllerId: string, portId: string): void {
    const controller = this.known(controllerId);
    if (controller === null) {
      return;
    }
    if (controller.lastPortId !== portId) {
      this.store.upsertController({ controller: { ...controller, lastPortId: portId } });
    }
    this.persistence.scheduleSave();
  }

  /** Turns mapping mode on or off. Turning it on asks for MIDI access first when it is not
   *  granted, so call it from a user gesture. Turning it off removes the controllers that have no
   *  mappings. */
  async setMappingMode(on: boolean): Promise<void> {
    if (on && this.midiAccess.accessState() !== 'granted') {
      await this.midiAccess.requestAccess();
    }
    this.store.setMappingMode({ on });
    if (!on) {
      this.pruneUnmapped();
    }
  }

  /**
   * The controller behind an input port, made if it is new. A controller already resolved to the
   * port is returned; otherwise a missing or ambiguous one with the same name is pointed at the
   * port; otherwise a new listening controller is created.
   */
  ensureController(portId: string, portName: string): string {
    const name = controllerName(portName);
    const controllers = this.store.controllers();
    const status = this.store.controllerStatus();

    let id =
      this.controllerForPort(portId) ??
      controllers.find((controller) => controller.lastPortId === portId)?.id ??
      null;
    if (id === null) {
      const unresolved = controllers.find(
        (controller) =>
          controller.name === name &&
          (status[controller.id] === 'missing' || status[controller.id] === 'unmatched')
      );
      if (unresolved !== undefined) {
        id = unresolved.id;
        this.store.upsertController({ controller: { ...unresolved, lastPortId: portId } });
      } else {
        id = crypto.randomUUID();
        this.store.upsertController({
          controller: { id, name, lastPortId: portId, listening: true },
        });
      }
    }

    // Until the next policy run resolves it, messages from this port must already find its owner.
    if (this.store.controllerPorts()[id] !== portId) {
      this.store.setControllerRuntime({ id, status: status[id] ?? 'idle', portId });
    }
    this.persistence.scheduleSave();
    return id;
  }

  /** The known controller resolved to an input port, or `null`. */
  controllerForPort(portId: string): string | null {
    return this.controllerByPort().get(portId) ?? null;
  }

  private known(controllerId: string): KnownController | null {
    return this.store.controllers().find((controller) => controller.id === controllerId) ?? null;
  }

  private pruneUnmapped(): void {
    const unmapped = this.store
      .controllers()
      .filter((controller) => !this.store.hasMappings(controller.id)());
    for (const controller of unmapped) {
      this.store.removeController({ id: controller.id });
    }
    if (unmapped.length > 0) {
      this.persistence.scheduleSave();
    }
  }

  private async drain(): Promise<void> {
    try {
      do {
        this.rerun = false;
        try {
          await this.runPolicy();
        } catch (error) {
          logWarn(
            `MidiControllers: applying the port policy failed — ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } while (this.rerun);
    } finally {
      this.draining = null;
    }
  }

  /** Does nothing until MIDI access is granted: before then the input list is empty because it has
   *  not been enumerated, not because the controllers are gone, so no status is set and no alert is
   *  raised. Access being granted re-runs the policy. */
  private async runPolicy(): Promise<void> {
    if (this.midiAccess.accessState() !== 'granted') {
      return;
    }
    const generation = this.generation;
    const connected = this.midiInput.inputs().filter((port) => port.connected);
    const controllers = this.store.controllers();

    const resolutions = this.resolvePorts(controllers, connected);
    this.adoptResolvedPorts(controllers, resolutions);

    const wanted = this.portsToHold(controllers, connected, resolutions);
    this.release(wanted);
    const opened = await this.open(wanted);
    if (generation !== this.generation) {
      return;
    }

    this.updateStatuses(controllers, resolutions, opened);
  }

  /** Finds each controller's connected input: its last port id first, then the single unclaimed
   *  input carrying its name. */
  private resolvePorts(
    controllers: readonly KnownController[],
    connected: readonly MidiInputPort[]
  ): Map<string, Resolution> {
    const resolutions = new Map<string, Resolution>();
    const claimed = new Set<string>();
    const connectedIds = new Set(connected.map((port) => port.id));

    for (const controller of controllers) {
      const portId = controller.lastPortId;
      if (portId !== null && connectedIds.has(portId) && !claimed.has(portId)) {
        claimed.add(portId);
        resolutions.set(controller.id, { portId, unmatched: false });
      }
    }
    for (const controller of controllers) {
      if (resolutions.has(controller.id)) {
        continue;
      }
      const matches = connected.filter(
        (port) => !claimed.has(port.id) && controllerName(port.name) === controller.name
      );
      if (matches.length === 1) {
        claimed.add(matches[0].id);
        resolutions.set(controller.id, { portId: matches[0].id, unmatched: false });
      } else {
        resolutions.set(controller.id, { portId: null, unmatched: matches.length > 1 });
      }
    }
    return resolutions;
  }

  /** Saves the port a controller was found on by name as its last port, so the next run finds it
   *  by id and writes nothing. */
  private adoptResolvedPorts(
    controllers: readonly KnownController[],
    resolutions: ReadonlyMap<string, Resolution>
  ): void {
    let changed = false;
    for (const controller of controllers) {
      const portId = resolutions.get(controller.id)?.portId ?? null;
      if (portId !== null && portId !== controller.lastPortId) {
        this.store.upsertController({ controller: { ...controller, lastPortId: portId } });
        changed = true;
      }
    }
    if (changed) {
      this.persistence.scheduleSave();
    }
  }

  private portsToHold(
    controllers: readonly KnownController[],
    connected: readonly MidiInputPort[],
    resolutions: ReadonlyMap<string, Resolution>
  ): ReadonlySet<string> {
    if (this.store.mappingMode()) {
      return new Set(connected.filter(isControllerPort).map((port) => port.id));
    }
    const wanted = new Set<string>();
    for (const controller of controllers) {
      const portId = resolutions.get(controller.id)?.portId ?? null;
      if (portId !== null && controller.listening && this.store.hasMappings(controller.id)()) {
        wanted.add(portId);
      }
    }
    return wanted;
  }

  private release(wanted: ReadonlySet<string>): void {
    for (const portId of [...this.held]) {
      if (!wanted.has(portId)) {
        this.held.delete(portId);
        this.midiInput.close(portId);
        logInfo(LogType.Midi, `MIDI input "${portId}" released`);
      }
    }
  }

  /** Opens every wanted port that is not open yet; resolves each wanted port's outcome. */
  private async open(
    wanted: ReadonlySet<string>
  ): Promise<ReadonlyMap<string, MidiInputOpenResult>> {
    const outcomes = new Map<string, MidiInputOpenResult>();
    await Promise.all(
      [...wanted].map(async (portId) => {
        if (this.midiInput.isOpen(portId)) {
          this.held.add(portId);
          outcomes.set(portId, 'open');
          return;
        }
        const result = await this.midiInput.open(portId);
        outcomes.set(portId, result);
        if (result === 'open') {
          this.held.add(portId);
          logInfo(LogType.Midi, `MIDI input "${portId}" opened`);
        }
      })
    );
    return outcomes;
  }

  private updateStatuses(
    controllers: readonly KnownController[],
    resolutions: ReadonlyMap<string, Resolution>,
    opened: ReadonlyMap<string, MidiInputOpenResult>
  ): void {
    const statuses = this.store.controllerStatus();
    const ports = this.store.controllerPorts();

    for (const controller of controllers) {
      const resolution = resolutions.get(controller.id) ?? { portId: null, unmatched: false };
      const status = this.statusOf(controller, resolution, opened);
      const previous = statuses[controller.id];

      if (previous !== status || ports[controller.id] !== resolution.portId) {
        this.store.setControllerRuntime({
          id: controller.id,
          status,
          portId: resolution.portId,
        });
      }
      if (previous !== status) {
        this.onTransition(controller, previous, status);
      }
    }
  }

  private statusOf(
    controller: KnownController,
    resolution: Resolution,
    opened: ReadonlyMap<string, MidiInputOpenResult>
  ): ControllerStatus {
    if (!controller.listening) {
      return 'off';
    }
    if (!this.store.hasMappings(controller.id)()) {
      return 'idle';
    }
    if (resolution.unmatched) {
      return 'unmatched';
    }
    if (resolution.portId === null) {
      return 'missing';
    }
    const result = opened.get(resolution.portId) ?? 'missing';
    return result === 'open' ? 'listening' : result;
  }

  private onTransition(
    controller: KnownController,
    previous: ControllerStatus | undefined,
    status: ControllerStatus
  ): void {
    if (previous === 'listening') {
      this.engine.releaseHolds(controller.id);
    }
    if (isAlertStatus(status)) {
      logInfo(LogType.Midi, `MIDI controller "${controller.name}" lost: ${status}`);
      this.alertService.warning(alertText(controller.name, status));
    } else if (status === 'listening') {
      logInfo(
        LogType.Midi,
        isAlertStatus(previous)
          ? `MIDI controller "${controller.name}" returned`
          : `MIDI controller "${controller.name}" is listening`
      );
    }
  }
}
