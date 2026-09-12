import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { CrossfaderComponent, DeckStripComponent } from '@teensyrom-nx/ui/components';
import { DjMixerCardComponent } from './dj-mixer-card.component';
import type { DeckRef } from '../deck-ref';

function render(
  decks: readonly DeckRef[],
  showCrossfader: boolean
): ComponentFixture<DjMixerCardComponent> {
  TestBed.configureTestingModule({
    imports: [DjMixerCardComponent],
    providers: [provideNoopAnimations()],
  });

  const fixture = TestBed.createComponent(DjMixerCardComponent);
  fixture.componentRef.setInput('decks', decks);
  fixture.componentRef.setInput('showCrossfader', showCrossfader);
  fixture.detectChanges();
  return fixture;
}

describe('DjMixerCardComponent', () => {
  it('renders one strip and no crossfader for a single deck', () => {
    const fixture = render([{ letter: 'A', index: 0 }], false);

    const strips = fixture.debugElement.queryAll(By.directive(DeckStripComponent));
    expect(strips.length).toBe(1);
    expect((strips[0].componentInstance as DeckStripComponent).model().fader.label).toBe('A');
    expect(fixture.nativeElement.querySelector('lib-crossfader')).toBeNull();
  });

  it('renders two strips and a crossfader labelled A to B for two decks', () => {
    const fixture = render(
      [
        { letter: 'A', index: 0 },
        { letter: 'B', index: 1 },
      ],
      true
    );

    const strips = fixture.debugElement.queryAll(By.directive(DeckStripComponent));
    expect(strips.map((s) => (s.componentInstance as DeckStripComponent).model().fader.label)).toEqual([
      'A',
      'B',
    ]);

    const crossfader = fixture.debugElement.query(By.directive(CrossfaderComponent))
      .componentInstance as CrossfaderComponent;
    expect(crossfader.startLabel()).toBe('A');
    expect(crossfader.endLabel()).toBe('B');
    expect(crossfader.accessibleName()).toBe('Crossfader, deck A to deck B');
  });

  it('toggles the band host class from the band input', () => {
    const fixture = render([{ letter: 'A', index: 0 }], false);
    expect(fixture.nativeElement.classList.contains('dj-mixer-card--band')).toBe(false);

    fixture.componentRef.setInput('band', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.classList.contains('dj-mixer-card--band')).toBe(true);
  });
});
