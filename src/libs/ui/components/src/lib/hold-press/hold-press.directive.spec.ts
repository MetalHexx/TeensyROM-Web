import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { HoldPressDirective } from './hold-press.directive';

@Component({
  imports: [HoldPressDirective],
  template: `
    @if (shown()) {
    <button
      type="button"
      libHoldPress
      [holdDisabled]="disabled()"
      (holdChange)="emitted.push($event)"
    >
      Hold
    </button>
    }
  `,
})
class HostComponent {
  readonly disabled = signal(false);
  readonly shown = signal(true);
  readonly emitted: boolean[] = [];
}

// jsdom has no `PointerEvent` constructor — a `MouseEvent` carries what the directive reads, with
// `pointerId` added directly since dispatch matches on the event's `type` string.
function pointerEvent(type: string): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event as unknown as PointerEvent;
}

describe('HoldPressDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function key(type: 'keydown' | 'keyup', init: KeyboardEventInit): void {
    button().dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }));
  }

  it('emits true on pointerdown and false on pointerup', () => {
    button().dispatchEvent(pointerEvent('pointerdown'));
    expect(host.emitted).toEqual([true]);
    button().dispatchEvent(pointerEvent('pointerup'));
    expect(host.emitted).toEqual([true, false]);
  });

  it('releases on pointercancel', () => {
    button().dispatchEvent(pointerEvent('pointerdown'));
    button().dispatchEvent(pointerEvent('pointercancel'));
    expect(host.emitted).toEqual([true, false]);
  });

  it.each(['Enter', ' '])('holds on %j keydown and releases on keyup', (k) => {
    key('keydown', { key: k });
    key('keyup', { key: k });
    expect(host.emitted).toEqual([true, false]);
  });

  it('prevents default on Enter and Space but ignores other keys', () => {
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    button().dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    key('keyup', { key: ' ' });

    const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    button().dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    expect(host.emitted).toEqual([true, false]);
  });

  it('ignores key auto-repeat', () => {
    key('keydown', { key: 'Enter' });
    key('keydown', { key: 'Enter', repeat: true });
    key('keydown', { key: 'Enter', repeat: true });
    expect(host.emitted).toEqual([true]);
  });

  it('ends a keyboard hold on blur', () => {
    key('keydown', { key: 'Enter' });
    button().dispatchEvent(new FocusEvent('blur'));
    expect(host.emitted).toEqual([true, false]);
  });

  it('does not end a pointer hold on blur', () => {
    button().dispatchEvent(pointerEvent('pointerdown'));
    button().dispatchEvent(new FocusEvent('blur'));
    expect(host.emitted).toEqual([true]);
  });

  it('emits nothing while disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();
    button().dispatchEvent(pointerEvent('pointerdown'));
    key('keydown', { key: 'Enter' });
    expect(host.emitted).toEqual([]);
  });

  it('emits one release when disabled mid-hold', () => {
    button().dispatchEvent(pointerEvent('pointerdown'));
    host.disabled.set(true);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(host.emitted).toEqual([true, false]);
  });

  it('emits one release when destroyed mid-hold', () => {
    button().dispatchEvent(pointerEvent('pointerdown'));
    host.shown.set(false);
    fixture.detectChanges();
    expect(host.emitted).toEqual([true, false]);
  });

  it('emits no release on destroy when not held', () => {
    host.shown.set(false);
    fixture.detectChanges();
    expect(host.emitted).toEqual([]);
  });
});
