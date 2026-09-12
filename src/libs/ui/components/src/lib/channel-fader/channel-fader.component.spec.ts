import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelFaderComponent } from './channel-fader.component';

describe('ChannelFaderComponent', () => {
  let fixture: ComponentFixture<ChannelFaderComponent>;
  let component: ChannelFaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelFaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelFaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('value', 1);
    fixture.componentRef.setInput('accessibleName', 'Channel fader deck A');
    fixture.detectChanges();
  });

  function rangeInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  it('emits the raw numeric value unrounded on input', () => {
    const emitted: number[] = [];
    component.valueChange.subscribe((v) => emitted.push(v));

    const input = rangeInput();
    input.value = '0.137';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([0.137]);
  });

  it('defaults min/max/step onto the underlying range input', () => {
    const input = rangeInput();

    expect(input.min).toBe('0');
    expect(input.max).toBe('1');
    expect(input.step).toBe('0.01');
  });

  it('reaches custom min/max/step through to the underlying range input', () => {
    fixture.componentRef.setInput('min', -1);
    fixture.componentRef.setInput('max', 1);
    fixture.componentRef.setInput('step', 0.5);
    fixture.detectChanges();

    const input = rangeInput();
    expect(input.min).toBe('-1');
    expect(input.max).toBe('1');
    expect(input.step).toBe('0.5');
  });

  it('renders the label when set', () => {
    fixture.componentRef.setInput('label', 'A');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.channel-fader-label').textContent.trim()).toBe(
      'A'
    );
  });

  it('omits the label element when null', () => {
    fixture.componentRef.setInput('label', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.channel-fader-label')).toBeNull();
  });

  it('names itself from the caller-supplied accessible name', () => {
    expect(rangeInput().getAttribute('aria-label')).toBe('Channel fader deck A');
  });

  it('reflects the value input rather than any local state', () => {
    fixture.componentRef.setInput('value', 0.42);
    fixture.detectChanges();

    expect(rangeInput().value).toBe('0.42');
  });
});
