import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { DeviceStore } from '@teensyrom-nx/application';
import { DjMixerViewComponent } from './dj-mixer-view.component';

function device(isEnabled: boolean) {
  return { isEnabled };
}

function render(devices: unknown[]) {
  TestBed.configureTestingModule({
    imports: [DjMixerViewComponent],
    providers: [
      provideNoopAnimations(),
      { provide: DeviceStore, useValue: { devices: signal(devices) } },
    ],
  });

  const fixture: ComponentFixture<DjMixerViewComponent> =
    TestBed.createComponent(DjMixerViewComponent);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

function deckLetters(fixture: ComponentFixture<DjMixerViewComponent>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('[data-deck]')).map((el) =>
    (el as HTMLElement).getAttribute('data-deck')
  ) as string[];
}

describe('DjMixerViewComponent', () => {
  it('renders one deck column per enabled device, lettered in store order, plus a mixer card', () => {
    const { fixture, component } = render([device(true), device(true), device(true)]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(3);
    expect(deckLetters(fixture)).toEqual(['A', 'B', 'C']);
    expect(fixture.nativeElement.querySelectorAll('lib-dj-mixer-card').length).toBe(1);
    expect(component.showCrossfader()).toBe(true);
    expect(component.isMany()).toBe(true);
  });

  it('filters out disabled devices, keeping the enabled-list positions contiguous', () => {
    const { fixture, component } = render([device(true), device(false), device(true)]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
    expect(deckLetters(fixture)).toEqual(['A', 'B']);
    expect(component.showCrossfader()).toBe(true);
    expect(component.isMany()).toBe(false);
  });

  it('renders a single column and mixer card with no crossfader when only one device is enabled', () => {
    const { fixture, component } = render([device(true)]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(1);
    expect(deckLetters(fixture)).toEqual(['A']);
    expect(fixture.nativeElement.querySelectorAll('lib-dj-mixer-card').length).toBe(1);
    expect(component.showCrossfader()).toBe(false);
  });

  it('renders the empty state and no mixer grid when no devices are enabled', () => {
    const { fixture } = render([device(false)]);

    const emptyState = fixture.nativeElement.querySelector('lib-empty-state-message');
    expect(emptyState).toBeTruthy();
    expect(emptyState.querySelector('.empty-state-title')?.textContent?.trim()).toBe(
      'No Enabled Devices'
    );
    expect(fixture.nativeElement.querySelector('.mixer-grid')).toBeNull();
  });
});
