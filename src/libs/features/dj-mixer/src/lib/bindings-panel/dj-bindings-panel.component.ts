import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  DECK_SLOTS,
  MappableControls,
  MidiControllers,
  MidiLearn,
  MidiMappings,
  MidiMappingStore,
  controlKey,
  defaultAmountFor,
  describeSource,
  describeStyle,
  isRelativeKind,
  ownerLabel,
  stylesFor,
  type ControlMapping,
  type ControlOwner,
  type ControllerStatus,
  type KnownController,
  type MappableControl,
  type MappingStyleKind,
} from '@teensyrom-nx/application';
import {
  BindingRowComponent,
  ControllerRowComponent,
  IconButtonComponent,
  SidePanelComponent,
  type BindingRowAmount,
  type BindingRowModel,
  type ControllerRowModel,
} from '@teensyrom-nx/ui/components';

const GROUP_OWNERS: readonly ControlOwner[] = [...DECK_SLOTS, 'mixer'];

/** Why a controller's bindings are not live, shown on each of its rows. A controller that is
 *  listening, or has not yet settled to a status, raises nothing. */
const BINDING_STATUS_TEXT: Record<ControllerStatus, string | null> = {
  listening: null,
  idle: null,
  off: 'Controller off',
  missing: 'Controller not connected',
  unavailable: 'Controller in use by another application',
  unmatched: "Choose the controller's port under Controllers",
};

/** A controller's own status line. */
const CONTROLLER_STATUS_TEXT: Record<ControllerStatus, string> = {
  listening: 'Listening',
  idle: 'No mappings',
  off: 'Off',
  missing: 'Not connected',
  unavailable: 'In use by another application',
  unmatched: 'Choose its port',
};

/** The one place the percent shown in the panel meets the fraction the mapping keeps. */
const PERCENT = 100;

/** The statuses whose controller has no port the app can use, and so offers a port to choose. */
const PORTLESS_STATUSES: readonly ControllerStatus[] = ['missing', 'unmatched'];

/** One mapping's row, with what its outputs need to act on it. */
interface BindingRowView {
  readonly mapping: ControlMapping;
  readonly control: MappableControl;
  readonly styleKinds: readonly MappingStyleKind[];
  readonly model: BindingRowModel;
}

interface BindingGroupView {
  readonly owner: ControlOwner;
  readonly heading: string;
  readonly rows: readonly BindingRowView[];
}

interface ControllerView {
  readonly id: string;
  readonly model: ControllerRowModel;
}

/** `deck A` as `Deck A`, `mixer` as `Mixer`. */
function ownerHeading(owner: ControlOwner): string {
  const label = ownerLabel(owner);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** A fraction as the percent the panel shows, to the one decimal the style chip uses. */
function toPercent(amount: number): number {
  return Number((amount * PERCENT).toFixed(1));
}

/** The amount field for a style that takes one, or `null`. The field works in percent, and the
 *  mapping keeps a fraction. */
function amountField(kind: MappingStyleKind, amount: number | null): BindingRowAmount | null {
  if (amount === null) {
    return null;
  }
  if (isRelativeKind(kind)) {
    return {
      label: 'Sensitivity',
      value: toPercent(amount),
      min: 0.1,
      max: 100,
      step: 0.1,
      suffix: '%',
    };
  }
  if (kind === 'hold') {
    return {
      label: 'Amount',
      value: toPercent(amount),
      min: 0.1,
      max: 100,
      step: 0.1,
      suffix: '%',
    };
  }
  return kind === 'step'
    ? { label: 'Amount', value: toPercent(amount), min: -100, max: 100, step: 0.1, suffix: '%' }
    : null;
}

/**
 * The bindings panel: every mapping grouped by what it drives and editable in place, the mapping
 * mode switch, the learn prompt while a control waits for hardware, and the known controllers.
 *
 * It reads the MIDI mapping store and commands through `MidiMappings`, `MidiLearn` and
 * `MidiControllers`; the presentational rows it renders hold no state of their own.
 */
@Component({
  selector: 'lib-dj-bindings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSlideToggleModule,
    SidePanelComponent,
    BindingRowComponent,
    ControllerRowComponent,
    IconButtonComponent,
  ],
  templateUrl: './dj-bindings-panel.component.html',
  styleUrl: './dj-bindings-panel.component.scss',
})
export class DjBindingsPanelComponent {
  private readonly store = inject(MidiMappingStore);
  private readonly controls = inject(MappableControls);
  private readonly midiControllers = inject(MidiControllers);
  private readonly midiLearn = inject(MidiLearn);
  private readonly midiMappings = inject(MidiMappings);

  /** Duration in milliseconds of the panel card's own entry animation; `0` for reduced motion. */
  readonly animationDuration = input<number>(400);

  /** Emits when the panel's close button is pressed. */
  readonly closePanel = output<void>();

  private readonly mappingSwitch = viewChild(MatSlideToggle);

  readonly mappingMode = this.store.mappingMode;
  readonly announcement = this.store.announcement;

  /** The mapping whose row is open for editing; one at a time. */
  readonly expandedId = signal<string | null>(null);

  /** The control being learned and what the user should do next, or `null` outside learn. */
  readonly learnPrompt = computed(() => {
    const learn = this.store.learn();
    if (learn === null) {
      return null;
    }
    const name = this.controls.find(learn.control)?.name ?? learn.control.control;
    return {
      name: `${ownerHeading(learn.control.owner)} · ${name}`,
      hint: learn.phase === 'sampling' ? 'Turn it both ways…' : 'Move a control on your hardware',
    };
  });

  /** Each owner that has controls (Deck A and Deck B; the Mixer owns none today), with its
   *  mappings in control-list order, then source order. */
  readonly groups = computed<readonly BindingGroupView[]>(() => {
    const controllers = this.store.controllers();
    const statuses = this.store.controllerStatus();
    const expandedId = this.expandedId();
    const controlOrder = new Map(
      this.controls.all.map((control, index) => [controlKey(control.identity), index])
    );
    const controllerOrder = new Map(controllers.map((controller, index) => [controller.id, index]));
    const mappings = this.store.mappings();
    const owners = new Set(this.controls.all.map((control) => control.identity.owner));

    return GROUP_OWNERS.filter((owner) => owners.has(owner)).map((owner) => {
      const rows = mappings
        .filter((mapping) => mapping.control.owner === owner)
        .flatMap((mapping) => {
          const control = this.controls.find(mapping.control);
          return control === null ? [] : [{ mapping, control }];
        })
        .sort(
          (a, b) =>
            (controlOrder.get(controlKey(a.mapping.control)) ?? 0) -
              (controlOrder.get(controlKey(b.mapping.control)) ?? 0) ||
            compareSources(a.mapping, b.mapping, controllerOrder)
        )
        .map(({ mapping, control }) =>
          this.rowView(mapping, control, controllers, statuses, expandedId)
        );
      return { owner, heading: ownerHeading(owner), rows };
    });
  });

  /** One row per known controller, in the order they were first seen. */
  readonly controllerRows = computed<readonly ControllerView[]>(() => {
    const statuses = this.store.controllerStatus();
    const ports = this.store.controllerPorts();
    const inputs = this.midiControllers.connectedInputs();

    return this.store.controllers().map((controller) => {
      const status = statuses[controller.id] ?? 'missing';
      const heldElsewhere = new Set(
        Object.entries(ports)
          .filter(([id, portId]) => id !== controller.id && portId !== null)
          .map(([, portId]) => portId)
      );
      return {
        id: controller.id,
        model: {
          name: controller.name,
          statusText: CONTROLLER_STATUS_TEXT[status],
          listening: controller.listening,
          toggleAccessibleName: `Listen to ${controller.name}`,
          portChoice: PORTLESS_STATUSES.includes(status)
            ? {
                options: inputs
                  .filter((port) => !heldElsewhere.has(port.id))
                  .map((port) => ({ id: port.id, label: port.name })),
                accessibleName: `Port for ${controller.name}`,
              }
            : null,
        },
      };
    });
  });

  /** Moves keyboard focus to the mapping mode switch, the panel's first control. */
  focusEntry(): void {
    this.mappingSwitch()?.focus();
  }

  /** Turns mapping mode on or off. The switch's click is the gesture MIDI access needs. */
  onMappingModeChange(on: boolean): void {
    void this.midiControllers.setMappingMode(on);
  }

  onCancelLearn(): void {
    this.midiLearn.cancel();
  }

  onEditToggle(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  onStyleSelect(row: BindingRowView, kind: string): void {
    const chosen = row.styleKinds.find((styleKind) => styleKind === kind);
    if (chosen === undefined) {
      return;
    }
    this.midiMappings.setStyle(row.mapping.id, {
      kind: chosen,
      amount: defaultAmountFor(row.control, chosen),
    });
  }

  onAmountChange(row: BindingRowView, percent: number): void {
    this.midiMappings.setStyle(row.mapping.id, {
      kind: row.mapping.style.kind,
      amount: percent / PERCENT,
    });
  }

  onRelearn(id: string): void {
    void this.midiLearn.relearn(id);
  }

  onDelete(id: string): void {
    this.midiMappings.remove(id);
  }

  onListeningChange(controllerId: string, on: boolean): void {
    this.midiControllers.setListening(controllerId, on);
  }

  onPortSelect(controllerId: string, portId: string): void {
    this.midiControllers.pointAt(controllerId, portId);
  }

  private rowView(
    mapping: ControlMapping,
    control: MappableControl,
    controllers: readonly KnownController[],
    statuses: Readonly<Record<string, ControllerStatus>>,
    expandedId: string | null
  ): BindingRowView {
    const styleKinds = stylesFor(control.nature, mapping.source.kind);
    const owner = ownerLabel(mapping.control.owner);

    return {
      mapping,
      control,
      styleKinds,
      model: {
        name: control.name,
        sourceText: describeSource(mapping.source, controllers),
        styleText: describeStyle(mapping.style),
        expanded: expandedId === mapping.id,
        styleOptions: styleKinds.map((kind) => ({
          id: kind,
          label: describeStyle({ kind, amount: null }),
        })),
        selectedStyleId: mapping.style.kind,
        amount: amountField(mapping.style.kind, mapping.style.amount),
        statusText: BINDING_STATUS_TEXT[statuses[mapping.source.controllerId] ?? 'missing'],
        editAccessibleName: `Edit ${control.name} binding, ${owner}`,
        deleteAccessibleName: `Delete ${control.name} binding, ${owner}`,
      },
    };
  }
}

/** Orders two mappings on one control: by the controller's place in the list, then channel, kind
 *  and number. */
function compareSources(
  a: ControlMapping,
  b: ControlMapping,
  controllerOrder: ReadonlyMap<string, number>
): number {
  return (
    (controllerOrder.get(a.source.controllerId) ?? Number.MAX_SAFE_INTEGER) -
      (controllerOrder.get(b.source.controllerId) ?? Number.MAX_SAFE_INTEGER) ||
    a.source.channel - b.source.channel ||
    a.source.kind.localeCompare(b.source.kind) ||
    a.source.number - b.source.number
  );
}
