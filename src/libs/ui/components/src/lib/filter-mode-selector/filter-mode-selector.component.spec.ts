import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FilterModeSelectorComponent,
  FilterModeSelectorModel,
  FilterModeValue,
} from './filter-mode-selector.component';

describe('FilterModeSelectorComponent', () => {
  let fixture: ComponentFixture<FilterModeSelectorComponent>;
  let component: FilterModeSelectorComponent;

  function modelWith(engaged: FilterModeValue | null): FilterModeSelectorModel {
    return {
      engaged,
      groupAccessibleName: 'Filter mode deck A',
      optionAccessibleNames: {
        lowPass: 'Filter mode low-pass deck A',
        bandPass: 'Filter mode band-pass deck A',
        highPass: 'Filter mode high-pass deck A',
        off: 'Filter mode off deck A',
      },
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterModeSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterModeSelectorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('model', modelWith(null));
    fixture.detectChanges();
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  function buttonNamed(name: string): HTMLButtonElement {
    const button = buttons().find((candidate) =>
      candidate.getAttribute('aria-label')?.includes(name)
    );
    if (!button) throw new Error(`no button named ${name}`);
    return button;
  }

  it('renders LP, BP, HP and OFF as four adjacent single-tap buttons', () => {
    expect(buttons()).toHaveLength(4);
    for (const button of buttons()) {
      expect(button.getAttribute('type')).toBe('button');
    }
  });

  it('starts with nothing engaged, matching a null model', () => {
    for (const button of buttons()) {
      expect(button.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('clicking an unengaged option emits that mode', () => {
    const emitted: (FilterModeValue | null)[] = [];
    component.modeSelect.subscribe((v) => emitted.push(v));

    buttonNamed('band-pass').click();

    expect(emitted).toEqual(['bandPass']);
  });

  it('clicking the engaged option emits null', () => {
    fixture.componentRef.setInput('model', modelWith('highPass'));
    fixture.detectChanges();

    const emitted: (FilterModeValue | null)[] = [];
    component.modeSelect.subscribe((v) => emitted.push(v));

    buttonNamed('high-pass').click();

    expect(emitted).toEqual([null]);
  });

  it('the engaged option carries aria-pressed="true" and no other does', () => {
    fixture.componentRef.setInput('model', modelWith('bandPass'));
    fixture.detectChanges();

    expect(buttonNamed('band-pass').getAttribute('aria-pressed')).toBe('true');
    expect(buttonNamed('low-pass').getAttribute('aria-pressed')).toBe('false');
    expect(buttonNamed('high-pass').getAttribute('aria-pressed')).toBe('false');
    expect(buttonNamed('off').getAttribute('aria-pressed')).toBe('false');
  });

  it('OFF is itself a mode, toggled the same way as the other three', () => {
    fixture.componentRef.setInput('model', modelWith('off'));
    fixture.detectChanges();

    expect(buttonNamed('off').getAttribute('aria-pressed')).toBe('true');

    const emitted: (FilterModeValue | null)[] = [];
    component.modeSelect.subscribe((v) => emitted.push(v));
    buttonNamed('off').click();

    expect(emitted).toEqual([null]);
  });

  it('names each option from the caller-supplied accessible names', () => {
    expect(buttonNamed('low-pass').getAttribute('aria-label')).toBe(
      'Filter mode low-pass deck A'
    );
    expect(buttonNamed('off').getAttribute('aria-label')).toBe('Filter mode off deck A');
  });

  it('labels the group from the caller-supplied accessible name', () => {
    expect(fixture.nativeElement.querySelector('[role="group"]').getAttribute('aria-label')).toBe(
      'Filter mode deck A'
    );
  });

  it('carries no dropdown', () => {
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });

  it('defaults data-size to large and reflects the size input', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('data-size')).toBe('large');

    fixture.componentRef.setInput('size', 'small');
    fixture.detectChanges();

    expect(host.getAttribute('data-size')).toBe('small');
  });
});
