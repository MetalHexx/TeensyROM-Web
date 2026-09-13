import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { StorageType } from '@teensyrom-nx/domain';
import {
  BindingCardComponent,
  LoopsCuesPanelComponent,
  SpeedPanelComponent,
  TransportPanelComponent,
  VoicePanelComponent,
} from '@teensyrom-nx/ui/components';
import { DjDeckColumnComponent } from './dj-deck-column.component';
import { DJ_FILE_DRAG_TYPE, type DjFileDragPayload } from '../drag/dj-file-drag';
import type { DeckRef } from '../deck-ref';

const LIFTED_PANEL_TYPES = [
  TransportPanelComponent,
  VoicePanelComponent,
  SpeedPanelComponent,
  LoopsCuesPanelComponent,
  BindingCardComponent,
] as const;

function render(deck: DeckRef, dropActive = false): ComponentFixture<DjDeckColumnComponent> {
  TestBed.configureTestingModule({
    imports: [DjDeckColumnComponent],
    providers: [provideNoopAnimations()],
  });

  const fixture = TestBed.createComponent(DjDeckColumnComponent);
  fixture.componentRef.setInput('deck', deck);
  fixture.componentRef.setInput('dropActive', dropActive);
  fixture.detectChanges();
  return fixture;
}

/** A `DragEvent` carrying only the `types` list — enough for `isDjFileDrag`'s `dragenter`/`dragover`/`dragleave` check. */
function dragEventWithTypes(type: string, types: string[]): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  const dataTransfer = { types, dropEffect: 'none' } as unknown as DataTransfer;
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, configurable: true });
  return event;
}

/** A `drop` `DragEvent` carrying the JSON-encoded payload under `DJ_FILE_DRAG_TYPE`, or none. */
function dropEventWithPayload(payload: DjFileDragPayload | null): DragEvent {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
  const dataTransfer = {
    types: payload ? [DJ_FILE_DRAG_TYPE] : [],
    getData: (type: string) => (payload && type === DJ_FILE_DRAG_TYPE ? JSON.stringify(payload) : ''),
  } as unknown as DataTransfer;
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, configurable: true });
  return event;
}

function gridAreas(fixture: ComponentFixture<DjDeckColumnComponent>): string[] {
  return Array.from(fixture.nativeElement.children).map(
    (el) => (el as HTMLElement).style.gridArea
  );
}

/** Every output on a component instance, found by duck-typing Angular's `OutputEmitterRef`. */
function outputsOf(instance: object): { emit: (value: unknown) => void }[] {
  return Object.values(instance as Record<string, unknown>).filter(
    (value): value is { emit: (value: unknown) => void } =>
      !!value && typeof value === 'object' && typeof (value as { emit?: unknown }).emit === 'function'
  );
}

describe('DjDeckColumnComponent', () => {
  it('contributes a deck stack and a voice/speed column to the view grid for deck index 0', () => {
    const fixture = render({ letter: 'A', index: 0 });
    expect(gridAreas(fixture)).toEqual(['d0', 'vs0']);

    expect(fixture.nativeElement.querySelectorAll('lib-scaling-compact-card').length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('lib-scaling-card').length).toBe(0);
  });

  it('contributes a deck stack and a voice/speed column to the view grid for deck index 1', () => {
    const fixture = render({ letter: 'B', index: 1 });
    expect(gridAreas(fixture)).toEqual(['d1', 'vs1']);
  });

  it('stacks the transport, Loops/Cues and the binding card in that order inside the deck stack', () => {
    const fixture = render({ letter: 'A', index: 0 });
    const stack = fixture.nativeElement.querySelector('.deck-stack') as HTMLElement;
    const slots = ['.transport-slot', '.loops-card', '.binding-card-slot'].map((selector) =>
      stack.querySelector(`:scope > ${selector}`)
    );

    expect(slots.every(Boolean)).toBe(true);
    expect(Array.from(stack.children)).toEqual(slots);
  });

  it('feeds every lifted panel from the deck placeholders, letter-scoped', () => {
    const fixture = render({ letter: 'B', index: 1 });
    const binding = fixture.debugElement.query(By.directive(BindingCardComponent))
      .componentInstance as BindingCardComponent;

    expect(binding.model().heading).toBe('Deck B');
  });

  it('lays the binding card out inline — one line at the bottom of the deck stack', () => {
    const fixture = render({ letter: 'A', index: 0 });
    const binding = fixture.debugElement.query(By.directive(BindingCardComponent))
      .componentInstance as BindingCardComponent;

    expect(binding.layout()).toBe('inline');
  });

  it('binds no output handlers on the lifted panels', () => {
    const fixture = render({ letter: 'A', index: 0 });
    const before = fixture.nativeElement.textContent;

    expect(() => {
      LIFTED_PANEL_TYPES.forEach((type) => {
        const instance = fixture.debugElement.query(By.directive(type)).componentInstance;
        outputsOf(instance).forEach((output) => output.emit(undefined));
      });
    }).not.toThrow();

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe(before);
  });

  describe('the drop overlay', () => {
    function overlay(fixture: ComponentFixture<DjDeckColumnComponent>): HTMLElement | null {
      return fixture.nativeElement.querySelector('.drop-overlay');
    }

    it('renders no overlay when dropActive is false', () => {
      const fixture = render({ letter: 'B', index: 1 }, false);

      expect(overlay(fixture)).toBeNull();
    });

    it('renders exactly one overlay labelled for the deck when dropActive is true', () => {
      const fixture = render({ letter: 'B', index: 1 }, true);

      expect(fixture.nativeElement.querySelectorAll('.drop-overlay').length).toBe(1);
      expect(overlay(fixture)?.textContent?.trim()).toBe('Drop to load — Deck B');
    });

    it('sets --hot on dragenter with the custom type and clears it on the matching dragleave', () => {
      const fixture = render({ letter: 'B', index: 1 }, true);
      const el = overlay(fixture) as HTMLElement;

      el.dispatchEvent(dragEventWithTypes('dragenter', [DJ_FILE_DRAG_TYPE]));
      fixture.detectChanges();
      expect(el.classList.contains('drop-overlay--hot')).toBe(true);

      el.dispatchEvent(dragEventWithTypes('dragleave', [DJ_FILE_DRAG_TYPE]));
      fixture.detectChanges();
      expect(el.classList.contains('drop-overlay--hot')).toBe(false);
    });

    it('ignores a dragenter that does not carry the DJ file type', () => {
      const fixture = render({ letter: 'B', index: 1 }, true);
      const el = overlay(fixture) as HTMLElement;

      el.dispatchEvent(dragEventWithTypes('dragenter', ['Files']));
      fixture.detectChanges();

      expect(el.classList.contains('drop-overlay--hot')).toBe(false);
    });

    it('emits fileDropped with the parsed payload on a drop carrying the type', () => {
      const fixture = render({ letter: 'B', index: 1 }, true);
      const el = overlay(fixture) as HTMLElement;
      const payload: DjFileDragPayload = {
        deviceId: 'device-1',
        storageType: StorageType.Sd,
        path: '/song.sid',
        fileName: 'song.sid',
      };
      const emitted: DjFileDragPayload[] = [];
      fixture.componentInstance.fileDropped.subscribe((p) => emitted.push(p));

      el.dispatchEvent(dropEventWithPayload(payload));

      expect(emitted).toEqual([payload]);
    });

    it('emits nothing on a drop without the DJ file type', () => {
      const fixture = render({ letter: 'B', index: 1 }, true);
      const el = overlay(fixture) as HTMLElement;
      const emitted: DjFileDragPayload[] = [];
      fixture.componentInstance.fileDropped.subscribe((p) => emitted.push(p));

      el.dispatchEvent(dropEventWithPayload(null));

      expect(emitted).toEqual([]);
    });
  });
});
