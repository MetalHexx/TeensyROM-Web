import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import {
  BindingCardComponent,
  LoopsCuesPanelComponent,
  ScalingCardComponent,
  SpeedPanelComponent,
  TransportPanelComponent,
  VoicePanelComponent,
} from '@teensyrom-nx/ui/components';
import { DjDeckColumnComponent } from './dj-deck-column.component';
import type { DeckRef } from '../deck-ref';

const LIFTED_PANEL_TYPES = [
  TransportPanelComponent,
  VoicePanelComponent,
  SpeedPanelComponent,
  LoopsCuesPanelComponent,
  BindingCardComponent,
] as const;

function render(deck: DeckRef): ComponentFixture<DjDeckColumnComponent> {
  TestBed.configureTestingModule({
    imports: [DjDeckColumnComponent],
    providers: [provideNoopAnimations()],
  });

  const fixture = TestBed.createComponent(DjDeckColumnComponent);
  fixture.componentRef.setInput('deck', deck);
  fixture.detectChanges();
  return fixture;
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
  it('places the six house cards on the view grid for deck index 0', () => {
    const fixture = render({ letter: 'A', index: 0 });
    expect(gridAreas(fixture)).toEqual(['t0', 'c0', 'b0', 'd0', 'vs0']);

    expect(fixture.nativeElement.querySelectorAll('lib-scaling-compact-card').length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('lib-scaling-card').length).toBe(1);
  });

  it('places the six house cards on the view grid for deck index 1', () => {
    const fixture = render({ letter: 'B', index: 1 });
    expect(gridAreas(fixture)).toEqual(['t1', 'c1', 'b1', 'd1', 'vs1']);
  });

  it('reserves an empty card titled Directory Listing', () => {
    const fixture = render({ letter: 'A', index: 0 });
    const reserved = fixture.debugElement.query(By.directive(ScalingCardComponent))
      .componentInstance as ScalingCardComponent;

    expect(reserved.title()).toBe('Directory Listing');
  });

  it('feeds every lifted panel from the deck placeholders, letter-scoped', () => {
    const fixture = render({ letter: 'B', index: 1 });
    const binding = fixture.debugElement.query(By.directive(BindingCardComponent))
      .componentInstance as BindingCardComponent;

    expect(binding.model().heading).toBe('Deck B');
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
});
