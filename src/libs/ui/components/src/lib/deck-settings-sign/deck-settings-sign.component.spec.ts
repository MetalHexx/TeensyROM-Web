import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeckSettingsSignComponent,
  type DeckSettingsSignModel,
} from './deck-settings-sign.component';

const main: DeckSettingsSignModel = {
  text: 'Main',
  own: false,
  accessibleName: 'Settings in play deck A: Main',
};

describe('DeckSettingsSignComponent', () => {
  let fixture: ComponentFixture<DeckSettingsSignComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeckSettingsSignComponent] }).compileComponents();
    fixture = TestBed.createComponent(DeckSettingsSignComponent);
    setModel(main);
  });

  function setModel(model: DeckSettingsSignModel): void {
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;

  it('shows the text and is labelled by the accessible name', () => {
    expect(el().textContent?.trim()).toBe('Main');
    expect(el().getAttribute('aria-label')).toBe('Settings in play deck A: Main');
  });

  it('marks the host with data-own only while a marker owns the settings', () => {
    expect(el().hasAttribute('data-own')).toBe(false);
    setModel({ text: 'Item 2', own: true, accessibleName: 'Settings in play deck A: Item 2' });
    expect(el().hasAttribute('data-own')).toBe(true);
    expect(el().textContent?.trim()).toBe('Item 2');
    expect(el().getAttribute('aria-label')).toBe('Settings in play deck A: Item 2');
  });

  it('hides the decorative dot from assistive tech', () => {
    expect(el().querySelector('.dot')?.getAttribute('aria-hidden')).toBe('true');
  });
});
