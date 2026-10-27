import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeckSetRowComponent, type DeckSetRowModel } from './deck-set-row.component';

const model: DeckSetRowModel = {
  positionText: '02/08',
  setName: 'Friday warm-up',
  previousDisabled: false,
  nextDisabled: false,
  previousAccessibleName: 'Previous in the set deck A',
  nextAccessibleName: 'Next in the set deck A',
};

describe('DeckSetRowComponent', () => {
  let fixture: ComponentFixture<DeckSetRowComponent>;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeckSetRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(DeckSetRowComponent);
    emitted = [];
    fixture.componentInstance.previous.subscribe(() => emitted.push('previous'));
    fixture.componentInstance.next.subscribe(() => emitted.push('next'));
    setModel({});
  });

  function setModel(overrides: Partial<DeckSetRowModel>): void {
    fixture.componentRef.setInput('model', { ...model, ...overrides });
    fixture.detectChanges();
  }

  const key = (control: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`[data-control="${control}"] button`) as HTMLButtonElement;

  it('emits previous and next from its keys, named by the caller', () => {
    key('set-previous').click();
    key('set-next').click();

    expect(emitted).toEqual(['previous', 'next']);
    expect(key('set-previous').getAttribute('aria-label')).toBe('Previous in the set deck A');
    expect(key('set-next').getAttribute('aria-label')).toBe('Next in the set deck A');
  });

  it('reads out the position and the set name', () => {
    const text = fixture.nativeElement.querySelector('.readout').textContent;

    expect(text).toContain('SET');
    expect(text).toContain('02/08');
    expect(text).toContain('Friday warm-up');
  });

  it('disables the key the model disables, and only that one', () => {
    setModel({ previousDisabled: true });
    key('set-previous').click();
    key('set-next').click();

    expect(key('set-previous').disabled).toBe(true);
    expect(emitted).toEqual(['next']);
  });

  it('shows dashes and a name-less readout with no set', () => {
    setModel({ positionText: '— / —', setName: '', previousDisabled: true, nextDisabled: true });
    key('set-previous').click();
    key('set-next').click();

    expect(fixture.nativeElement.querySelector('.position').textContent).toBe('— / —');
    expect(fixture.nativeElement.querySelector('.name').textContent).toBe('');
    expect(emitted).toEqual([]);
  });
});
