import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeckLabelComponent } from './deck-label.component';

describe('DeckLabelComponent', () => {
  let fixture: ComponentFixture<DeckLabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeckLabelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DeckLabelComponent);
    fixture.componentRef.setInput('label', 'Deck A');
    fixture.detectChanges();
  });

  it('shows the label input', () => {
    expect(fixture.nativeElement.textContent).toContain('Deck A');
  });

  it('puts the accent at the start by default', () => {
    expect(fixture.nativeElement.getAttribute('data-accent-side')).toBe('start');
  });

  it('reflects accentSide on the host', () => {
    fixture.componentRef.setInput('accentSide', 'end');
    fixture.detectChanges();

    expect(fixture.nativeElement.getAttribute('data-accent-side')).toBe('end');
  });
});
