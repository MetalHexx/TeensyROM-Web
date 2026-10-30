import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  DECK_SLOTS,
  HAND_GRIP_SECONDS,
  HAND_REACH_SECONDS,
  MappableControls,
  MidiControllers,
  MidiLearn,
  MidiMappings,
  MidiMappingStore,
  actionOf,
  actionsForControl,
  defaultAmountFor,
  describeAction,
  describeSource,
  describeStyle,
  describeTrigger,
  isRelativeKind,
  isStepKind,
  kindFor,
  ownerLabel,
  triggerOf,
  type ControlMapping,
  type ControlOwner,
  type ControllerStatus,
  type KnownController,
  type MappableControl,
  type MappingStyle,
  type MappingStyleKind,
  type StyleAction,
  type StyleTrigger,
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

/** Orders names the way a person reads them: 'Loop 2' before 'Loop 10', 'a' beside 'A'. */
const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const GROUP_OWNERS: readonly ControlOwner[] = [...DECK_SLOTS, 'mixer', 'set'];

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

/** The one place the milliseconds shown for a hand meet the seconds the mapping keeps. */
const MS_PER_SECOND = 1000;

/** The statuses whose controller has no port the app can use, and so offers a port to choose. */
const PORTLESS_STATUSES: readonly ControllerStatus[] = ['missing', 'unmatched'];

/** The key edges a style can act on, in the order the Trigger choice lists them. */
const TRIGGERS: readonly StyleTrigger[] = ['press', 'release'];

/** One mapping's row, with what its outputs need to act on it. */
interface BindingRowView {
  readonly mapping: ControlMapping;
  readonly control: MappableControl;
  readonly actions: readonly StyleAction[];
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

/** The `id` of a section's heading, which takes programmatic focus. */
function groupTitleId(owner: ControlOwner): string {
  return `bindings-group-${owner}`;
}

/** `deck A` as `Deck A`, `mixer` as `Mixer`, `set` as `Set`. */
function ownerHeading(owner: ControlOwner): string {
  const label = ownerLabel(owner);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** A fraction as the percent the panel shows, to the one decimal the style chip uses. */
function toPercent(amount: number): number {
  return Number((amount * PERCENT).toFixed(1));
}

/** Seconds as the whole milliseconds the panel shows. */
function toMilliseconds(seconds: number): number {
  return Math.round(seconds * MS_PER_SECOND);
}

/** A hand's Reach, in milliseconds. */
function reachField(style: MappingStyle): BindingRowAmount {
  return {
    label: 'Reach',
    value: toMilliseconds(style.amount ?? HAND_REACH_SECONDS.home),
    min: toMilliseconds(HAND_REACH_SECONDS.min),
    max: toMilliseconds(HAND_REACH_SECONDS.max),
    step: 10,
    suffix: 'ms',
  };
}

/** A hand's Grip, in milliseconds. */
function gripField(style: MappingStyle): BindingRowAmount {
  return {
    label: 'Grip',
    value: toMilliseconds(style.grip ?? HAND_GRIP_SECONDS.home),
    min: toMilliseconds(HAND_GRIP_SECONDS.min),
    max: toMilliseconds(HAND_GRIP_SECONDS.max),
    step: 10,
    suffix: 'ms',
  };
}

/** The amount field for a style that takes one, or `null`. The field works in percent, and the
 *  mapping keeps a fraction. A whole-step control moves one place whatever the amount, so a
 *  relative style has none and a step style shows the amount only for its sign: the direction. */
function amountField(
  control: MappableControl,
  kind: MappingStyleKind,
  amount: number | null
): BindingRowAmount | null {
  if (amount === null) {
    return null;
  }
  if (control.nature === 'value' && control.wholeSteps) {
    return isStepKind(kind)
      ? {
          label: 'Direction (+ next, − previous)',
          value: toPercent(amount),
          min: -100,
          max: 100,
          step: 0.1,
          suffix: '%',
        }
      : null;
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
  return isStepKind(kind)
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
  private readonly injector = inject(Injector);

  /** Duration in milliseconds of the panel card's own entry animation; `0` for reduced motion. */
  readonly animationDuration = input<number>(400);

  /** Emits when the panel's close button is pressed. */
  readonly closePanel = output<void>();

  private readonly mappingSwitch = viewChild(MatSlideToggle);
  private readonly bindingRows = viewChildren(BindingRowComponent);
  private readonly groupTitles = viewChildren<ElementRef<HTMLElement>>('groupTitle');

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

  /** Each owner that has controls (Deck A and Deck B, the Set; the Mixer owns none today), with its
   *  mappings by control name (naturally, ignoring case), then source order. */
  readonly groups = computed<readonly BindingGroupView[]>(() => {
    const controllers = this.store.controllers();
    const statuses = this.store.controllerStatus();
    const expandedId = this.expandedId();
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
            NAME_COLLATOR.compare(a.control.name, b.control.name) ||
            compareSources(a.mapping, b.mapping, controllerOrder)
        )
        .map(({ mapping, control }) =>
          this.rowView(mapping, control, controllers, statuses, expandedId)
        );
      return { owner, heading: ownerHeading(owner), rows };
    });
  });

  /** One row per known controller, by name. */
  readonly controllerRows = computed<readonly ControllerView[]>(() => {
    const statuses = this.store.controllerStatus();
    const ports = this.store.controllerPorts();
    const inputs = this.midiControllers.connectedInputs();

    const controllers = [...this.store.controllers()].sort((a, b) =>
      NAME_COLLATOR.compare(a.name, b.name)
    );

    return controllers.map((controller) => {
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

  /** The `id` of a section's heading. */
  protected readonly groupTitleId = groupTitleId;

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

  /** Changes the binding's Action, keeping its Trigger and taking the Action's default amount. */
  onStyleSelect(row: BindingRowView, action: string): void {
    const chosen = row.actions.find((offered) => offered === action);
    if (chosen === undefined) {
      return;
    }
    const kind = kindFor(chosen, triggerOf(row.mapping.style.kind) ?? 'press');
    this.midiMappings.setStyle(row.mapping.id, {
      kind,
      amount: defaultAmountFor(row.control, kind),
    });
  }

  /** Changes the binding's Trigger, keeping its Action and amount. */
  onTriggerSelect(row: BindingRowView, trigger: string): void {
    const chosen = TRIGGERS.find((edge) => edge === trigger);
    if (chosen === undefined || triggerOf(row.mapping.style.kind) === null) {
      return;
    }
    this.midiMappings.setStyle(row.mapping.id, {
      kind: kindFor(actionOf(row.mapping.style.kind), chosen),
      amount: row.mapping.style.amount,
    });
  }

  /** Saves the amount: a hand's Reach (milliseconds, keeping its Grip) or the percent of any other
   *  style. */
  onAmountChange(row: BindingRowView, value: number): void {
    const style = row.mapping.style;
    if (style.kind === 'hand') {
      this.midiMappings.setStyle(row.mapping.id, {
        kind: 'hand',
        amount: value / MS_PER_SECOND,
        grip: style.grip,
      });
      return;
    }
    this.midiMappings.setStyle(row.mapping.id, { kind: style.kind, amount: value / PERCENT });
  }

  /** Saves a hand's Grip (milliseconds), keeping its Reach. */
  onSecondAmountChange(row: BindingRowView, ms: number): void {
    const style = row.mapping.style;
    if (style.kind !== 'hand') {
      return;
    }
    this.midiMappings.setStyle(row.mapping.id, {
      kind: 'hand',
      amount: style.amount,
      grip: ms / MS_PER_SECOND,
    });
  }

  onRelearn(id: string): void {
    void this.midiLearn.relearn(id);
  }

  /** Deletes the binding, then keeps keyboard focus in place: on the edit button of the row that
   *  slid into its spot, or on the section heading when it was the section's last row. */
  onDelete(id: string): void {
    const groups = this.groups();
    const group = groups.find((candidate) => candidate.rows.some((row) => row.mapping.id === id));
    const index = group?.rows.findIndex((row) => row.mapping.id === id) ?? -1;
    this.midiMappings.remove(id);
    if (group === undefined) {
      return;
    }
    afterNextRender(() => this.focusAfterDelete(group.owner, index), { injector: this.injector });
  }

  private focusAfterDelete(owner: ControlOwner, index: number): void {
    const groups = this.groups();
    const groupIndex = groups.findIndex((candidate) => candidate.owner === owner);
    if (groupIndex < 0) {
      return;
    }
    if (index < groups[groupIndex].rows.length) {
      const flat =
        groups.slice(0, groupIndex).reduce((total, group) => total + group.rows.length, 0) + index;
      this.bindingRows()[flat]?.focusEdit();
      return;
    }
    this.groupTitles()
      .find((title) => title.nativeElement.id === groupTitleId(owner))
      ?.nativeElement.focus();
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
    const actions = actionsForControl(control, mapping.source.kind);
    const trigger = triggerOf(mapping.style.kind);
    const owner = ownerLabel(mapping.control.owner);

    return {
      mapping,
      control,
      actions,
      model: {
        name: control.name,
        sourceText: describeSource(mapping.source, controllers),
        styleText: describeStyle(mapping.style, mapping.source.kind),
        expanded: expandedId === mapping.id,
        styleLabel: choosesAction(control, mapping) ? 'Action' : 'Style',
        styleOptions: actions.includes('fire')
          ? []
          : actions.map((action) => ({ id: action, label: describeAction(action) })),
        selectedStyleId: actionOf(mapping.style.kind),
        triggerOptions:
          trigger === null
            ? null
            : TRIGGERS.map((edge) => ({
                id: edge,
                label: describeTrigger(edge, mapping.source.kind),
              })),
        selectedTriggerId: trigger,
        amount:
          mapping.style.kind === 'hand'
            ? reachField(mapping.style)
            : amountField(control, mapping.style.kind, mapping.style.amount),
        secondAmount: mapping.style.kind === 'hand' ? gripField(mapping.style) : null,
        statusText: BINDING_STATUS_TEXT[statuses[mapping.source.controllerId] ?? 'missing'],
        editAccessibleName: `Edit ${control.name} binding, ${owner}`,
        deleteAccessibleName: `Delete ${control.name} binding, ${owner}`,
      },
    };
  }
}

/** Whether the first choice reads as an Action (what a key does) rather than a Style (how a
 *  value is read): a one-shot, an on/off control, or a value stepped from a note. */
function choosesAction(control: MappableControl, mapping: ControlMapping): boolean {
  return (
    control.nature === 'trigger' ||
    control.nature === 'state' ||
    (control.nature === 'value' && mapping.source.kind === 'note')
  );
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
