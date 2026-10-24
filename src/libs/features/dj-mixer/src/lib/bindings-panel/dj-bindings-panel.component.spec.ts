import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  MappableControls,
  MidiControllers,
  MidiLearn,
  MidiMappings,
  MidiMappingStore,
  type ControlIdentity,
  type ControlMapping,
  type ControllerStatus,
  type KnownController,
  type MappableControl,
  type MappingStyle,
  type MidiSourceKind,
} from '@teensyrom-nx/application';
import { BindingRowComponent, ControllerRowComponent } from '@teensyrom-nx/ui/components';
import { DjBindingsPanelComponent } from './dj-bindings-panel.component';

const SPEED_A: ControlIdentity = { owner: 'A', control: 'speed' };
const STOP_A: ControlIdentity = { owner: 'A', control: 'stop' };
const STOP_B: ControlIdentity = { owner: 'B', control: 'stop' };
const KEY_B: ControlIdentity = { owner: 'B', control: 'key' };
const NUDGE_A: ControlIdentity = { owner: 'A', control: 'speed-nudge-up' };
const MUTE_A: ControlIdentity = { owner: 'A', control: 'voice-1-mute' };
const VOICE_HOLD_A: ControlIdentity = { owner: 'A', control: 'voice-1-hold' };
const MIXER_KEY: ControlIdentity = { owner: 'mixer', control: 'key' };

const DEFAULTS = { ccStyle: 'relative-offset', sensitivity: 0.01, stepAmount: 0.05 } as const;

const CONTROLS: readonly MappableControl[] = [
  { identity: STOP_A, name: 'Stop', nature: 'trigger', fire: () => undefined },
  {
    identity: SPEED_A,
    name: 'Speed',
    nature: 'value',
    min: 0.5,
    max: 1.5,
    home: 1,
    step: null,
    defaults: DEFAULTS,
    read: () => 1,
    set: () => undefined,
  },
  { identity: STOP_B, name: 'Stop', nature: 'trigger', fire: () => undefined },
  keyControl(KEY_B),
  {
    identity: MUTE_A,
    name: 'Voice 1 mute',
    nature: 'state',
    read: () => false,
    set: () => undefined,
  },
  {
    identity: NUDGE_A,
    name: 'Nudge up',
    nature: 'hold',
    amountDefault: 0.05,
    set: () => undefined,
  },
  {
    identity: VOICE_HOLD_A,
    name: 'Voice 1 kill / punch-in',
    nature: 'hold',
    amountDefault: null,
    set: () => undefined,
  },
];

function keyControl(identity: ControlIdentity): MappableControl {
  return {
    identity,
    name: 'Key',
    nature: 'value',
    min: -12,
    max: 12,
    home: 0,
    step: 1,
    defaults: DEFAULTS,
    read: () => 0,
    set: () => undefined,
  };
}

const XL: KnownController = {
  id: 'xl',
  name: 'Launch Control XL',
  lastPortId: 'p-xl',
  listening: true,
};
const NANO: KnownController = {
  id: 'nano',
  name: 'nanoKONTROL',
  lastPortId: null,
  listening: true,
};

function mapping(
  id: string,
  control: ControlIdentity,
  style: MappingStyle,
  {
    controllerId = 'xl',
    kind = 'cc',
    number = 21,
  }: { controllerId?: string; kind?: MidiSourceKind; number?: number } = {}
): ControlMapping {
  return { id, control, style, source: { controllerId, channel: 1, kind, number } };
}

function render(controls: readonly MappableControl[] = CONTROLS) {
  const controllers = {
    connectedInputs: signal<{ id: string; name: string }[]>([]),
    setMappingMode: vi.fn().mockResolvedValue(undefined),
    setListening: vi.fn(),
    pointAt: vi.fn(),
  };
  const learn = { select: vi.fn(), cancel: vi.fn(), relearn: vi.fn().mockResolvedValue(undefined) };
  const mappings = { setStyle: vi.fn(), remove: vi.fn() };

  TestBed.configureTestingModule({
    imports: [DjBindingsPanelComponent],
    providers: [
      provideNoopAnimations(),
      {
        provide: MappableControls,
        useValue: {
          all: controls,
          find: (identity: ControlIdentity) =>
            controls.find(
              (c) => c.identity.owner === identity.owner && c.identity.control === identity.control
            ) ?? null,
        },
      },
      { provide: MidiControllers, useValue: controllers },
      { provide: MidiLearn, useValue: learn },
      { provide: MidiMappings, useValue: mappings },
    ],
  });

  const store = TestBed.inject(MidiMappingStore);
  const fixture: ComponentFixture<DjBindingsPanelComponent> =
    TestBed.createComponent(DjBindingsPanelComponent);
  fixture.detectChanges();

  const seed = (
    known: readonly KnownController[],
    mapped: readonly ControlMapping[],
    statuses: Record<string, ControllerStatus> = {}
  ) => {
    for (const controller of known) {
      store.upsertController({ controller });
    }
    for (const entry of mapped) {
      store.upsertMapping({ mapping: entry });
    }
    for (const [id, status] of Object.entries(statuses)) {
      store.setControllerRuntime({ id, status, portId: null });
    }
    fixture.detectChanges();
  };

  return { fixture, store, controllers, learn, mappings, seed };
}

type Fixture = ComponentFixture<DjBindingsPanelComponent>;

function rows(fixture: Fixture): BindingRowComponent[] {
  return fixture.debugElement
    .queryAll(By.directive(BindingRowComponent))
    .map((row) => row.componentInstance as BindingRowComponent);
}

function controllerRows(fixture: Fixture): ControllerRowComponent[] {
  return fixture.debugElement
    .queryAll(By.directive(ControllerRowComponent))
    .map((row) => row.componentInstance as ControllerRowComponent);
}

function groupRows(fixture: Fixture, heading: string): string[] {
  const group = Array.from(fixture.nativeElement.querySelectorAll('section.group')).find(
    (section) => (section as HTMLElement).querySelector('h3')?.textContent?.trim() === heading
  ) as HTMLElement;
  return Array.from(group.querySelectorAll('.binding-line')).map((line) =>
    (line.querySelector('.binding-name')?.textContent ?? '').trim()
  );
}

function clickButton(fixture: Fixture, label: string): void {
  const button = fixture.nativeElement.querySelector(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`no button labelled ${label}`);
  (button as HTMLButtonElement).click();
  fixture.detectChanges();
}

describe('DjBindingsPanelComponent', () => {
  describe('the groups', () => {
    const headings = (fixture: Fixture) =>
      Array.from(fixture.nativeElement.querySelectorAll('h3')).map((h) =>
        (h as HTMLElement).textContent?.trim()
      );

    it('headed Deck A and Deck B, with a placeholder for a deck without bindings and no Mixer group', () => {
      const { fixture, seed } = render();
      seed([XL], [mapping('m1', KEY_B, { kind: 'absolute', amount: null })]);

      expect(headings(fixture)).toEqual(['Deck A', 'Deck B', 'Controllers']);
      expect(groupRows(fixture, 'Deck B')).toEqual(['Key']);
      expect(fixture.nativeElement.textContent.match(/No bindings yet/g)).toHaveLength(1);
    });

    it('shows the Mixer group once the mixer owns a control', () => {
      const { fixture, seed } = render([...CONTROLS, keyControl(MIXER_KEY)]);
      seed([XL], [mapping('m1', MIXER_KEY, { kind: 'absolute', amount: null })]);

      expect(headings(fixture)).toEqual(['Deck A', 'Deck B', 'Mixer', 'Controllers']);
      expect(groupRows(fixture, 'Mixer')).toEqual(['Key']);
    });

    it('places each mapping under its owner, in control-list order and then by source', () => {
      const { fixture, seed } = render();
      seed(
        [XL, NANO],
        [
          mapping(
            'm1',
            SPEED_A,
            { kind: 'absolute', amount: null },
            { controllerId: 'nano', number: 3 }
          ),
          mapping('m2', SPEED_A, { kind: 'absolute', amount: null }, { number: 9 }),
          mapping('m3', STOP_A, { kind: 'press', amount: null }, { kind: 'note', number: 36 }),
          mapping('m4', STOP_B, { kind: 'press', amount: null }, { kind: 'note', number: 37 }),
        ]
      );

      expect(groupRows(fixture, 'Deck A')).toEqual(['Stop', 'Speed', 'Speed']);
      expect(rows(fixture).map((r) => r.model().sourceText)).toEqual([
        'Launch Control XL · ch 1 · Note 36',
        'Launch Control XL · ch 1 · CC 9',
        'nanoKONTROL · ch 1 · CC 3',
        'Launch Control XL · ch 1 · Note 37',
      ]);
      expect(groupRows(fixture, 'Deck B')).toEqual(['Stop']);
    });
  });

  describe('the row models', () => {
    function modelOf(fixture: Fixture, index = 0) {
      return rows(fixture)[index].model();
    }

    it('offers an on/off control its Action and Trigger, naming the trigger for the source', () => {
      const { fixture, seed } = render();
      seed(
        [XL],
        [
          mapping(
            'note',
            MUTE_A,
            { kind: 'off-release', amount: null },
            { kind: 'note', number: 1 }
          ),
          mapping('cc', MUTE_A, { kind: 'latch', amount: null }, { number: 2 }),
        ]
      );

      expect(modelOf(fixture, 1)).toMatchObject({
        styleText: 'Turn off · Note Off',
        styleLabel: 'Action',
        styleOptions: [
          { id: 'toggle', label: 'Toggle' },
          { id: 'on', label: 'Turn on' },
          { id: 'off', label: 'Turn off' },
        ],
        selectedStyleId: 'off',
        triggerOptions: [
          { id: 'press', label: 'Note On' },
          { id: 'release', label: 'Note Off' },
        ],
        selectedTriggerId: 'release',
      });
      expect(modelOf(fixture, 0).triggerOptions?.map((o) => o.label)).toEqual(['CC On', 'CC Off']);
    });

    it('offers a one-shot only its Trigger', () => {
      const { fixture, seed } = render();
      seed(
        [XL],
        [mapping('trigger', STOP_A, { kind: 'press', amount: null }, { kind: 'note', number: 1 })]
      );

      expect(modelOf(fixture)).toMatchObject({
        styleLabel: 'Action',
        styleOptions: [],
        selectedTriggerId: 'press',
      });
      expect(modelOf(fixture).triggerOptions?.map((o) => o.id)).toEqual(['press', 'release']);
    });

    it('offers a CC encoder a Style with the two relative options and no Trigger', () => {
      const { fixture, seed } = render();
      seed([XL], [mapping('value-cc', SPEED_A, { kind: 'relative-signed', amount: 0.01 })]);

      expect(modelOf(fixture)).toMatchObject({
        styleLabel: 'Style',
        selectedStyleId: 'relative-signed',
        triggerOptions: null,
        selectedTriggerId: null,
      });
      expect(modelOf(fixture).styleOptions.map((o) => o.label)).toEqual([
        'Absolute',
        'Relative (binary offset)',
        "Relative (two's complement)",
        'Step',
      ]);
    });

    it('offers a step key its Action, Trigger and Amount', () => {
      const { fixture, seed } = render();
      seed(
        [XL],
        [mapping('key', KEY_B, { kind: 'step-release', amount: 0.1 }, { kind: 'note', number: 2 })]
      );

      expect(modelOf(fixture)).toMatchObject({
        styleText: 'Step +10% · Note Off',
        styleLabel: 'Action',
        styleOptions: [{ id: 'step', label: 'Step' }],
        selectedTriggerId: 'release',
        amount: { label: 'Amount', value: 10 },
      });
    });

    it('shows a relative style as a sensitivity in percent and a step style as a signed amount', () => {
      const { fixture, seed } = render();
      seed(
        [XL],
        [
          mapping('relative', SPEED_A, { kind: 'relative-offset', amount: 0.015 }),
          mapping('step', KEY_B, { kind: 'step', amount: -0.1 }, { number: 22 }),
          mapping('trigger', STOP_B, { kind: 'press', amount: null }, { number: 23 }),
        ]
      );

      expect(modelOf(fixture, 0)).toMatchObject({
        selectedStyleId: 'relative-offset',
        styleText: 'Relative (binary offset) · 1.5%',
        amount: { label: 'Sensitivity', value: 1.5, min: 0.1, max: 100, suffix: '%' },
      });
      expect(modelOf(fixture, 2).amount).toEqual(
        expect.objectContaining({ label: 'Amount', value: -10, min: -100, max: 100 })
      );
      expect(modelOf(fixture, 1).amount).toBeNull();
    });

    it('shows a nudge hold with an editable amount in percent, and a voice hold with none', () => {
      const { fixture, seed } = render();
      seed(
        [XL],
        [
          mapping('nudge', NUDGE_A, { kind: 'hold', amount: 0.05 }, { kind: 'note', number: 30 }),
          mapping(
            'voice',
            VOICE_HOLD_A,
            { kind: 'hold', amount: null },
            { kind: 'note', number: 31 }
          ),
        ]
      );

      const nudge = [0, 1].map((i) => modelOf(fixture, i)).find((m) => m.amount !== null);
      expect(nudge).toMatchObject({
        styleText: 'Hold · 5%',
        amount: { label: 'Amount', value: 5, min: 0.1, max: 100, step: 0.1, suffix: '%' },
      });
      const voice = [0, 1].map((i) => modelOf(fixture, i)).find((m) => m.amount === null);
      expect(voice?.styleText).toBe('Hold');
    });

    it('names the edit and delete controls after the control and its owner', () => {
      const { fixture, seed } = render();
      seed([XL], [mapping('m1', SPEED_A, { kind: 'absolute', amount: null })]);

      expect(modelOf(fixture)).toMatchObject({
        name: 'Speed',
        editAccessibleName: 'Edit Speed binding, deck A',
        deleteAccessibleName: 'Delete Speed binding, deck A',
      });
    });

    it('gives a status only when the controller is not listening', () => {
      const { fixture, seed, store } = render();
      seed([XL], [mapping('m1', SPEED_A, { kind: 'absolute', amount: null })], { xl: 'listening' });
      expect(modelOf(fixture).statusText).toBeNull();

      store.setControllerRuntime({ id: 'xl', status: 'missing', portId: null });
      fixture.detectChanges();
      expect(modelOf(fixture).statusText).toBe('Controller not connected');

      store.setControllerRuntime({ id: 'xl', status: 'off', portId: null });
      fixture.detectChanges();
      expect(modelOf(fixture).statusText).toBe('Controller off');
    });
  });

  describe('editing in place', () => {
    function seedTwo() {
      const rendered = render();
      rendered.seed(
        [XL],
        [
          mapping('relative', SPEED_A, { kind: 'relative-offset', amount: 0.01 }),
          mapping('trigger', STOP_A, { kind: 'press', amount: null }, { kind: 'note', number: 1 }),
        ]
      );
      return rendered;
    }

    it('expands one row at a time, and collapses it from the same button', () => {
      const { fixture } = seedTwo();

      clickButton(fixture, 'Edit Stop binding, deck A');
      expect(rows(fixture).map((r) => r.model().expanded)).toEqual([true, false]);

      clickButton(fixture, 'Edit Speed binding, deck A');
      expect(rows(fixture).map((r) => r.model().expanded)).toEqual([false, true]);

      clickButton(fixture, 'Edit Speed binding, deck A');
      expect(rows(fixture).map((r) => r.model().expanded)).toEqual([false, false]);
    });

    it('applies a chosen style with that style default amount for the control', () => {
      const { fixture, mappings } = seedTwo();
      clickButton(fixture, 'Edit Speed binding, deck A');

      rows(fixture)[1].styleSelect.emit('step');
      rows(fixture)[1].styleSelect.emit('absolute');
      rows(fixture)[1].styleSelect.emit('not-an-action');

      expect(mappings.setStyle.mock.calls).toEqual([
        ['relative', { kind: 'step', amount: DEFAULTS.stepAmount }],
        ['relative', { kind: 'absolute', amount: null }],
      ]);
    });

    it('keeps the Trigger when the Action changes, and the Action and amount when the Trigger changes', () => {
      const { fixture, seed, mappings } = render();
      seed(
        [XL],
        [
          mapping(
            'mute',
            MUTE_A,
            { kind: 'off-release', amount: null },
            { kind: 'note', number: 1 }
          ),
          mapping('key', KEY_B, { kind: 'step', amount: 0.2 }, { kind: 'note', number: 2 }),
        ]
      );

      rows(fixture)[0].styleSelect.emit('toggle');
      rows(fixture)[0].triggerSelect.emit('press');
      rows(fixture)[1].triggerSelect.emit('release');
      rows(fixture)[0].triggerSelect.emit('not-a-trigger');

      expect(mappings.setStyle.mock.calls).toEqual([
        ['mute', { kind: 'latch-release', amount: null }],
        ['mute', { kind: 'off', amount: null }],
        ['key', { kind: 'step-release', amount: 0.2 }],
      ]);
    });

    it('divides an edited amount by 100 before applying it, keeping the style', () => {
      const { fixture, mappings } = seedTwo();
      clickButton(fixture, 'Edit Speed binding, deck A');

      const amount = fixture.nativeElement.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;
      expect(amount.value).toBe('1');
      amount.value = '2.5';
      amount.dispatchEvent(new Event('change'));

      expect(mappings.setStyle).toHaveBeenCalledWith('relative', {
        kind: 'relative-offset',
        amount: 0.025,
      });
    });

    it('starts re-learning the source, and deletes the binding', () => {
      const { fixture, learn, mappings } = seedTwo();

      rows(fixture)[1].relearn.emit();
      rows(fixture)[0].deleteBinding.emit();

      expect(learn.relearn).toHaveBeenCalledWith('relative');
      expect(mappings.remove).toHaveBeenCalledWith('trigger');
    });

    it('speaks the store announcement in a polite live region', () => {
      const { fixture, store } = render();
      const region = fixture.nativeElement.querySelector('[aria-live="polite"].visually-hidden');
      expect(region.textContent.trim()).toBe('');

      store.announce({ text: 'Binding deleted: Speed, deck A' });
      fixture.detectChanges();

      expect(region.textContent.trim()).toBe('Binding deleted: Speed, deck A');
    });
  });

  describe('mapping mode and learn', () => {
    it('reflects the store and asks MidiControllers to switch mapping mode on a flip', () => {
      const { fixture, store, controllers } = render();
      const toggle = fixture.nativeElement.querySelector(
        'mat-slide-toggle button[role="switch"]'
      ) as HTMLButtonElement;
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      toggle.click();
      fixture.detectChanges();
      expect(controllers.setMappingMode).toHaveBeenLastCalledWith(true);

      store.setMappingMode({ on: true });
      fixture.detectChanges();
      expect(toggle.getAttribute('aria-checked')).toBe('true');

      toggle.click();
      expect(controllers.setMappingMode).toHaveBeenLastCalledWith(false);
    });

    it('prompts for the control being learned while it waits, and again while it samples', () => {
      const { fixture, store } = render();
      expect(fixture.nativeElement.querySelector('.learn-prompt')).toBeNull();

      store.setLearn({
        learn: { control: STOP_B, phase: 'waiting', replacing: null, source: null },
      });
      fixture.detectChanges();
      const prompt = fixture.nativeElement.querySelector('.learn-prompt') as HTMLElement;
      expect(prompt.textContent).toContain('Deck B · Stop');
      expect(prompt.textContent).toContain('Move a control on your hardware');

      store.setLearn({
        learn: {
          control: SPEED_A,
          phase: 'sampling',
          replacing: null,
          source: { controllerId: 'xl', channel: 1, kind: 'cc', number: 5 },
        },
      });
      fixture.detectChanges();
      const sampling = fixture.nativeElement.querySelector('.learn-prompt') as HTMLElement;
      expect(sampling.textContent).toContain('Deck A · Speed');
      expect(sampling.textContent).toContain('Turn it both ways…');
    });

    it('cancels learning from the prompt', () => {
      const { fixture, store, learn } = render();
      store.setLearn({
        learn: { control: SPEED_A, phase: 'waiting', replacing: null, source: null },
      });
      fixture.detectChanges();

      clickButton(fixture, 'Cancel mapping');

      expect(learn.cancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('the controllers section', () => {
    it('gives each controller its status as text and its listening switch', () => {
      const { fixture, seed, controllers } = render();
      seed([XL, { ...NANO, listening: false }], [], { xl: 'listening', nano: 'off' });

      expect(controllerRows(fixture).map((r) => [r.model().name, r.model().statusText])).toEqual([
        ['Launch Control XL', 'Listening'],
        ['nanoKONTROL', 'Off'],
      ]);

      controllerRows(fixture)[1].listeningChange.emit(true);
      expect(controllers.setListening).toHaveBeenCalledWith('nano', true);
    });

    it('offers a port choice only to an unmatched or missing controller', () => {
      const { fixture, seed } = render();
      seed([XL, NANO], [], { xl: 'listening', nano: 'missing' });

      const [xl, nano] = controllerRows(fixture).map((r) => r.model());
      expect(xl.portChoice).toBeNull();
      expect(nano.portChoice?.accessibleName).toBe('Port for nanoKONTROL');
    });

    it('lists the connected inputs no other controller holds, and points the controller at the pick', () => {
      const { fixture, seed, store, controllers } = render();
      seed([XL, NANO], [], { xl: 'listening', nano: 'unmatched' });
      store.setControllerRuntime({ id: 'xl', status: 'listening', portId: 'p-xl' });
      controllers.connectedInputs.set([
        { id: 'p-xl', name: 'Launch Control XL' },
        { id: 'p-nano-1', name: 'nanoKONTROL' },
        { id: 'p-nano-2', name: 'nanoKONTROL' },
      ]);
      fixture.detectChanges();

      const choice = controllerRows(fixture)[1].model().portChoice;
      expect(choice?.options).toEqual([
        { id: 'p-nano-1', label: 'nanoKONTROL' },
        { id: 'p-nano-2', label: 'nanoKONTROL' },
      ]);

      controllerRows(fixture)[1].portSelect.emit('p-nano-2');
      expect(controllers.pointAt).toHaveBeenCalledWith('nano', 'p-nano-2');
    });
  });

  it('emits closePanel from the side panel close button', () => {
    const { fixture } = render();
    const closed = vi.fn();
    fixture.componentInstance.closePanel.subscribe(closed);

    clickButton(fixture, 'Close panel');

    expect(closed).toHaveBeenCalledTimes(1);
  });
});
