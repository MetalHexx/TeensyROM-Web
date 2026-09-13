import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceRowComponent, VoiceRowModel } from './voice-row.component';

function testModel(overrides: Partial<VoiceRowModel> = {}): VoiceRowModel {
  return {
    label: 'V1',
    muted: false,
    holdLabel: 'Kill',
    checkboxId: 'voice-mute-0-a',
    muteAccessibleName: 'Mute voice 1 deck A',
    holdAccessibleName: 'Kill voice 1 deck A',
    ...overrides,
  };
}

describe('VoiceRowComponent', () => {
  let fixture: ComponentFixture<VoiceRowComponent>;
  let component: VoiceRowComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [VoiceRowComponent] }).compileComponents();

    fixture = TestBed.createComponent(VoiceRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('model', testModel());
    fixture.detectChanges();
  });

  function holdButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.voice-hold');
  }

  function checkbox(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="checkbox"]');
  }

  // jsdom (this workspace's version) has no `PointerEvent` constructor — a `MouseEvent` carries
  // every field the component's handlers actually read (`target`) except `pointerId`, which is
  // added directly since dispatch matches on the event's `type` string, not its constructor.
  function pointerEvent(type: string, pointerId = 1): PointerEvent {
    const event = new MouseEvent(type, { bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    return event as unknown as PointerEvent;
  }

  it('emits heldChange(true) once on pointerdown', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(pointerEvent('pointerdown'));

    expect(emitted).toEqual([true]);
  });

  it('emits heldChange(false) on pointerup', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(pointerEvent('pointerdown'));
    holdButton().dispatchEvent(pointerEvent('pointerup'));

    expect(emitted).toEqual([true, false]);
  });

  it('emits heldChange(false) on pointercancel', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(pointerEvent('pointerdown'));
    holdButton().dispatchEvent(pointerEvent('pointercancel'));

    expect(emitted).toEqual([true, false]);
  });

  it('emits heldChange(true) on Enter keydown and heldChange(false) on Enter keyup', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    holdButton().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

    expect(emitted).toEqual([true, false]);
  });

  it("emits heldChange(true) on ' ' (Space) keydown", () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    expect(emitted).toEqual([true]);
  });

  it('emits nothing on a repeated keydown (browser auto-repeat)', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    holdButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true }));

    expect(emitted).toEqual([true]);
  });

  it('emits nothing on a keydown for an unrelated key', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(emitted).toEqual([]);
  });

  it('emits heldChange(false) on blur when focus leaves mid-hold without a matching keyup', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    holdButton().dispatchEvent(new Event('blur'));

    expect(emitted).toEqual([true, false]);
  });

  it('does not double-emit when keyup already ended the hold before blur', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    holdButton().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    holdButton().dispatchEvent(new Event('blur'));

    expect(emitted).toEqual([true, false]);
  });

  it('leaves a pointer hold alone on blur — pointer capture, not focus, ends it', () => {
    const emitted: boolean[] = [];
    component.heldChange.subscribe((held) => emitted.push(held));

    holdButton().dispatchEvent(pointerEvent('pointerdown'));
    holdButton().dispatchEvent(new Event('blur'));

    expect(emitted).toEqual([true]);
  });

  it("emits mutedChange with the checkbox's checked value", () => {
    const emitted: boolean[] = [];
    component.mutedChange.subscribe((muted) => emitted.push(muted));

    checkbox().checked = true;
    checkbox().dispatchEvent(new Event('change'));

    expect(emitted).toEqual([true]);
  });

  it("renders the hold button's text from holdLabel", () => {
    expect(holdButton().textContent?.trim()).toBe('Kill');

    fixture.componentRef.setInput('model', testModel({ muted: true, holdLabel: 'Punch' }));
    fixture.detectChanges();

    expect(holdButton().textContent?.trim()).toBe('Punch');
  });

  it('renders no state caption', () => {
    expect(fixture.nativeElement.querySelector('.voice-state')).toBeNull();
  });
});
