import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { CrossfaderComponent, DeckStripComponent } from '@teensyrom-nx/ui/components';
import { DjMixerCardComponent } from './dj-mixer-card.component';
import type { DeckRef } from '../deck-ref';

function render(
  decks: readonly DeckRef[],
  showCrossfader: boolean,
  belowTablet = false
): ComponentFixture<DjMixerCardComponent> {
  TestBed.configureTestingModule({
    imports: [DjMixerCardComponent],
    providers: [
      provideNoopAnimations(),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: belowTablet, breakpoints: {} }) },
      },
    ],
  });

  const fixture = TestBed.createComponent(DjMixerCardComponent);
  fixture.componentRef.setInput('decks', decks);
  fixture.componentRef.setInput('showCrossfader', showCrossfader);
  fixture.detectChanges();
  return fixture;
}

describe('DjMixerCardComponent', () => {
  it('renders one strip and no crossfader for a single deck', () => {
    const fixture = render([{ slot: 'A', letter: 'A', index: 0 }], false);

    const strips = fixture.debugElement.queryAll(By.directive(DeckStripComponent));
    expect(strips.length).toBe(1);
    expect((strips[0].componentInstance as DeckStripComponent).model().fader.label).toBe('A');
    expect(fixture.nativeElement.querySelector('lib-crossfader')).toBeNull();
  });

  it('renders two strips and a crossfader named, but not visibly labelled, A to B for two decks', () => {
    const fixture = render(
      [
        { slot: 'A', letter: 'A', index: 0 },
        { slot: 'B', letter: 'B', index: 1 },
      ],
      true
    );

    const strips = fixture.debugElement.queryAll(By.directive(DeckStripComponent));
    expect(strips.map((s) => (s.componentInstance as DeckStripComponent).model().fader.label)).toEqual([
      'A',
      'B',
    ]);

    // The channel faders above already show their own A/B labels, so the crossfader itself renders
    // none — its accessible name still carries the deck letters for assistive technology.
    const crossfader = fixture.debugElement.query(By.directive(CrossfaderComponent))
      .componentInstance as CrossfaderComponent;
    expect(crossfader.startLabel()).toBe('');
    expect(crossfader.endLabel()).toBe('');
    expect(crossfader.accessibleName()).toBe('Crossfader, deck A to deck B');
  });

  describe('the medium column form', () => {
    it('sizes every strip medium and hands it the same travel the crossfader gets', () => {
      const fixture = render(
        [
          { slot: 'A', letter: 'A', index: 0 },
          { slot: 'B', letter: 'B', index: 1 },
        ],
        true
      );

      const strips = fixture.debugElement
        .queryAll(By.directive(DeckStripComponent))
        .map((s) => s.componentInstance as DeckStripComponent);
      const crossfader = fixture.debugElement.query(By.directive(CrossfaderComponent))
        .componentInstance as CrossfaderComponent;

      expect(strips.map((s) => s.size())).toEqual(['medium', 'medium']);
      expect(crossfader.trackLength()).toBeTruthy();
      expect(strips.map((s) => s.faderLength())).toEqual([
        crossfader.trackLength(),
        crossfader.trackLength(),
      ]);
    });

    it('releases both travels in the band form, where the card is no longer a fixed column', () => {
      const fixture = render(
        [
          { slot: 'A', letter: 'A', index: 0 },
          { slot: 'B', letter: 'B', index: 1 },
        ],
        true,
        true
      );

      const strip = fixture.debugElement.query(By.directive(DeckStripComponent))
        .componentInstance as DeckStripComponent;
      const crossfader = fixture.debugElement.query(By.directive(CrossfaderComponent))
        .componentInstance as CrossfaderComponent;

      expect(strip.faderLength()).toBeNull();
      expect(crossfader.trackLength()).toBeNull();
    });
  });
});
