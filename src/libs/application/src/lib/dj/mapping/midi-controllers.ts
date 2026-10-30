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
import { controlKey, sourceKey, type ControlMapping, type KnownController } from './mapping.models';
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

/** The controllers and mappings once duplicate controllers are merged, and the mappings that
 *  merge dropped. */
interface Repair {
  readonly controllers: readonly KnownController[];
  readonly mappings: readonly ControlMapping[];
  readonly merged: number;
  readonly dropped: readonly ControlMapping[];
}

/**
 * Merges the controllers that share a name when at most one connected controller port carries
 * it; two or more such ports are separate devices and are left alone. The kept controller is the
 * one on that port, else the first saved, and it listens when any merged one did. Every mapping is
 * moved onto the kept controller, and only a mapping whose source then repeats an earlier one is
 * dropped. Returns `null` when nothing merged.
 */
function mergeDuplicateControllers(
  controllers: readonly KnownController[],
  mappings: readonly ControlMapping[],
  controllerPorts: readonly MidiInputPort[]
): Repair | null {
  const byName = new Map<string, KnownController[]>();
  for (const controller of controllers) {
    byName.set(controller.name, [...(byName.get(controller.name) ?? []), controller]);
  }

  const keptFor = new Map<string, string>();
  const merged = new Map<string, KnownController>();
  for (const [name, group] of byName) {
    const carriers = controllerPorts.filter((port) => controllerName(port.name) === name);
    if (group.length < 2 || carriers.length > 1) {
      continue;
    }
    const kept =
      group.find((controller) => carriers.some((port) => port.id === controller.lastPortId)) ??
      group[0];
    merged.set(kept.id, { ...kept, listening: group.some((controller) => controller.listening) });
    for (const controller of group) {
      if (controller !== kept) {
        keptFor.set(controller.id, kept.id);
      }
    }
  }
  if (keptFor.size === 0) {
    return null;
  }

  const seen = new Set<string>();
  const moved: ControlMapping[] = [];
  const dropped: ControlMapping[] = [];
  for (const mapping of mappings) {
    const controllerId = keptFor.get(mapping.source.controllerId);
    const rewritten: ControlMapping =
      controllerId === undefined
        ? mapping
        : { ...mapping, source: { ...mapping.source, controllerId } };
    const key = sourceKey(rewritten.source);
    if (seen.has(key)) {
      dropped.push(rewritten);
    } else {
      seen.add(key);
      moved.push(rewritten);
    }
  }

  return {
    controllers: controllers
      .filter((controller) => !keptFor.has(controller.id))
      .map((controller) => merged.get(controller.id) ?? controller),
    mappings: moved,
    merged: keptFor.size,
    dropped,
  };
}

/**
 * Owns the controllers' input ports, their runtime state and the alerts about them.
 *
 * A controller's port name is its identity. A saved controller is found again on the connected
 * input that carries its name: its last port id first, otherwise the one unclaimed input with the
 * name. A port id alone never claims a port, since the browser reshuffles them. Controllers saved
 * twice under one name are merged once per session. The ports held open follow one policy: only controllers that are listening and have mappings, except while
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
  private repaired = false;
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

  /** Chooses the input a controller listens to, which brings back every mapping on it. The
   *  operator is naming the device, so the controller takes the input's name and is found on it by
   *  that name from then on. An input that is not listed is ignored. */
  pointAt(controllerId: string, portId: string): void {
    const controller = this.known(controllerId);
    const port = this.midiInput.inputs().find((input) => input.id === portId);
    if (controller === null || port === undefined) {
      return;
    }
    const name = controllerName(port.name);
    if (controller.lastPortId !== portId || controller.name !== name) {
      this.store.upsertController({ controller: { ...controller, lastPortId: portId, name } });
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
   * port is returned; otherwise the known controller with the same name, in any status, that is
   * not on a different connected port is pointed at the port; otherwise a new listening
   * controller is created.
   */
  ensureController(portId: string, portName: string): string {
    const name = controllerName(portName);
    const status = this.store.controllerStatus();

    let id = this.controllerForPort(portId);
    if (id === null) {
      const ports = this.store.controllerPorts();
      const connectedIds = new Set(
        this.midiInput
          .inputs()
          .filter((port) => port.connected)
          .map((port) => port.id)
      );
      const sameName = this.store.controllers().find((controller) => {
        const resolved = ports[controller.id] ?? null;
        return controller.name === name && (resolved === null || !connectedIds.has(resolved));
      });
      if (sameName !== undefined) {
        id = sameName.id;
        this.store.upsertController({ controller: { ...sameName, lastPortId: portId } });
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
    if (!this.repaired) {
      this.repairDuplicateControllers(connected.filter(isControllerPort));
      this.repaired = true;
    }
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

  /** Merges the controllers saved twice under one name, saves the merged set and logs it. Runs
   *  before the policy reads the controllers, so every later step sees the merged list. */
  private repairDuplicateControllers(controllerPorts: readonly MidiInputPort[]): void {
    const repair = mergeDuplicateControllers(
      this.store.controllers(),
      this.store.mappings(),
      controllerPorts
    );
    if (repair === null) {
      return;
    }
    for (const { id, control } of repair.dropped) {
      logWarn(
        `MidiControllers: dropped mapping ${id} on ${controlKey(control)}, a repeated source.`
      );
    }
    this.store.repairControllers({ controllers: repair.controllers, mappings: repair.mappings });
    this.persistence.scheduleSave();
    logInfo(LogType.Midi, `MIDI controllers: merged ${repair.merged} duplicate controllers`);
  }

  /** Finds each controller's connected input, which must carry its name: its last port id first,
   *  then the single unclaimed input carrying the name. */
  private resolvePorts(
    controllers: readonly KnownController[],
    connected: readonly MidiInputPort[]
  ): Map<string, Resolution> {
    const resolutions = new Map<string, Resolution>();
    const claimed = new Set<string>();
    const candidates = connected.filter(isControllerPort);

    for (const controller of controllers) {
      const port = candidates.find((candidate) => candidate.id === controller.lastPortId);
      if (
        port !== undefined &&
        !claimed.has(port.id) &&
        controllerName(port.name) === controller.name
      ) {
        claimed.add(port.id);
        resolutions.set(controller.id, { portId: port.id, unmatched: false });
      }
    }
    for (const controller of controllers) {
      if (resolutions.has(controller.id)) {
        continue;
      }
      const matches = candidates.filter(
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
