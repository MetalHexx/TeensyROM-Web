import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectableRowComponent } from './selectable-row.component';

describe('SelectableRowComponent', () => {
  let fixture: ComponentFixture<SelectableRowComponent>;
  let host: HTMLElement;
  let selectSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SelectableRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(SelectableRowComponent);
    fixture.componentRef.setInput('label', 'Neon');
    fixture.detectChanges();
    host = fixture.nativeElement;
    selectSpy = vi.fn();
    fixture.componentInstance.selectedChange.subscribe(selectSpy);
  });

  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    host.dispatchEvent(event);
    return event;
  }

  it('is a focusable option that reports its selection state', () => {
    expect(host.getAttribute('role')).toBe('option');
    expect(host.getAttribute('aria-selected')).toBe('false');
    expect(host.getAttribute('tabindex')).toBe('0');
    expect(host.getAttribute('aria-disabled')).toBeNull();

    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();

    expect(host.getAttribute('aria-selected')).toBe('true');
    expect(host.classList).toContain('selected');
  });

  it('emits selectedChange on click, Enter and Space', () => {
    host.click();
    press('Enter');
    press(' ');

    expect(selectSpy).toHaveBeenCalledTimes(3);
  });

  it('prevents the default of Space so the page does not scroll', () => {
    expect(press(' ').defaultPrevented).toBe(true);
  });

  it('emits nothing and leaves the tab order when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    host.click();
    press('Enter');
    press(' ');

    expect(selectSpy).not.toHaveBeenCalled();
    expect(host.getAttribute('aria-disabled')).toBe('true');
    expect(host.getAttribute('tabindex')).toBe('-1');
    expect(host.classList).toContain('disabled');
  });

  it('renders the label', () => {
    expect(host.querySelector('.selectable-row__label')?.textContent?.trim()).toBe('Neon');
  });
});
