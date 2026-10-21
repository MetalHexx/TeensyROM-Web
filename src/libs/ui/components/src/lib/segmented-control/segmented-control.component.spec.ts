import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SegmentedControlComponent, SegmentedControlOption } from './segmented-control.component';

const OPTIONS: readonly SegmentedControlOption[] = [
  { id: 'absolute', label: 'Absolute' },
  { id: 'relative', label: 'Relative' },
  { id: 'step', label: 'Step', disabled: true },
  { id: 'toggle', label: 'Toggle' },
];

describe('SegmentedControlComponent', () => {
  let fixture: ComponentFixture<SegmentedControlComponent>;
  let component: SegmentedControlComponent;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SegmentedControlComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SegmentedControlComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('accessibleName', 'Style');
    fixture.componentRef.setInput('selectedId', 'relative');
    fixture.detectChanges();

    emitted = [];
    component.optionSelect.subscribe((id) => emitted.push(id));
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function segments(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll('button'));
  }

  function press(key: string, from: HTMLButtonElement): void {
    from.focus();
    from.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function select(id: string | null): void {
    fixture.componentRef.setInput('selectedId', id);
    fixture.detectChanges();
  }

  describe('semantics', () => {
    it('announces as a radio group carrying the accessible name', () => {
      const group = root().querySelector('[role="radiogroup"]');

      expect(group?.getAttribute('aria-label')).toBe('Style');
    });

    it('renders every option as a radio, checked only for the selected one', () => {
      expect(segments().map((segment) => segment.getAttribute('role'))).toEqual([
        'radio',
        'radio',
        'radio',
        'radio',
      ]);
      expect(segments().map((segment) => segment.getAttribute('aria-checked'))).toEqual([
        'false',
        'true',
        'false',
        'false',
      ]);
    });

    it('marks a disabled option disabled', () => {
      expect(segments().map((segment) => segment.disabled)).toEqual([false, false, true, false]);
    });
  });

  describe('roving tabindex', () => {
    function tabStops(): string[] {
      return segments()
        .filter((segment) => segment.getAttribute('tabindex') === '0')
        .map((segment) => segment.textContent?.trim() ?? '');
    }

    it('puts the selected option alone in the tab order', () => {
      expect(tabStops()).toEqual(['Relative']);
    });

    it('falls back to the first enabled option when nothing is selected', () => {
      select(null);

      expect(tabStops()).toEqual(['Absolute']);
    });

    it('falls back to the first enabled option when the selected one is disabled', () => {
      select('step');

      expect(tabStops()).toEqual(['Absolute']);
    });
  });

  describe('selection', () => {
    it('emits the clicked option', () => {
      segments()[3].click();

      expect(emitted).toEqual(['toggle']);
    });

    it('does not emit when the selected option is clicked again', () => {
      segments()[1].click();

      expect(emitted).toEqual([]);
    });
  });

  describe('keyboard', () => {
    it('moves focus and selection to the next enabled option on ArrowRight, skipping disabled ones', () => {
      press('ArrowRight', segments()[1]);

      expect(emitted).toEqual(['toggle']);
      expect(document.activeElement).toBe(segments()[3]);
    });

    it('treats ArrowDown like ArrowRight', () => {
      press('ArrowDown', segments()[3]);

      expect(emitted).toEqual(['absolute']);
    });

    it('moves to the previous enabled option on ArrowLeft and ArrowUp, skipping disabled ones', () => {
      select('absolute');

      press('ArrowLeft', segments()[3]);
      press('ArrowUp', segments()[3]);

      expect(emitted).toEqual(['relative', 'relative']);
    });

    it('wraps from the last enabled option to the first, and back', () => {
      press('ArrowRight', segments()[3]);
      press('ArrowLeft', segments()[0]);

      expect(emitted).toEqual(['absolute', 'toggle']);
    });

    it('jumps to the first enabled option on Home and the last on End', () => {
      press('Home', segments()[3]);
      press('End', segments()[0]);

      expect(emitted).toEqual(['absolute', 'toggle']);
    });

    it('leaves other keys alone', () => {
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      segments()[1].dispatchEvent(event);

      expect(emitted).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
    });

    it('does not emit when no other option is enabled', () => {
      fixture.componentRef.setInput('options', [
        { id: 'only', label: 'Only' },
        { id: 'off', label: 'Off', disabled: true },
      ]);
      select('only');

      press('ArrowRight', segments()[0]);

      expect(emitted).toEqual([]);
    });
  });
});
