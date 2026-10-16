import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { BindingRowAmount, BindingRowComponent, BindingRowModel } from './binding-row.component';

const AMOUNT: BindingRowAmount = {
  label: 'Amount',
  value: 1,
  min: 0.1,
  max: 10,
  step: 0.1,
  suffix: '%',
};

function modelWith(overrides: Partial<BindingRowModel> = {}): BindingRowModel {
  return {
    name: 'Speed',
    sourceText: 'Launch Control XL · ch 1 · CC 21',
    styleText: 'Relative · 1%',
    expanded: false,
    styleOptions: [
      { id: 'absolute', label: 'Absolute' },
      { id: 'relative', label: 'Relative' },
    ],
    selectedStyleId: 'relative',
    amount: AMOUNT,
    statusText: null,
    editAccessibleName: 'Edit Speed binding',
    deleteAccessibleName: 'Delete Speed binding',
    ...overrides,
  };
}

describe('BindingRowComponent', () => {
  let fixture: ComponentFixture<BindingRowComponent>;
  let component: BindingRowComponent;

  let editToggles: number;
  let styles: string[];
  let amounts: number[];
  let relearns: number;
  let deletes: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BindingRowComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(BindingRowComponent);
    component = fixture.componentInstance;

    editToggles = relearns = deletes = 0;
    styles = [];
    amounts = [];
    component.editToggle.subscribe(() => editToggles++);
    component.styleSelect.subscribe((id) => styles.push(id));
    component.amountChange.subscribe((value) => amounts.push(value));
    component.relearn.subscribe(() => relearns++);
    component.deleteBinding.subscribe(() => deletes++);

    setModel();
  });

  function setModel(overrides: Partial<BindingRowModel> = {}): void {
    fixture.componentRef.setInput('model', modelWith(overrides));
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function buttonNamed(name: string): HTMLButtonElement {
    const button = Array.from(root().querySelectorAll('button')).find(
      (candidate) => candidate.getAttribute('aria-label') === name
    );
    if (!button) throw new Error(`no button named ${name}`);
    return button;
  }

  function amountInput(): HTMLInputElement {
    return root().querySelector('input[type="number"]') as HTMLInputElement;
  }

  function enterAmount(text: string): void {
    amountInput().value = text;
    amountInput().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function alerts(): string[] {
    return Array.from(root().querySelectorAll('[role="alert"]')).map(
      (alert) => alert.textContent?.trim() ?? ''
    );
  }

  describe('collapsed', () => {
    it('shows the name, the style chip and the source', () => {
      const text = root().textContent ?? '';

      expect(text).toContain('Speed');
      expect(text).toContain('Relative · 1%');
      expect(text).toContain('Launch Control XL · ch 1 · CC 21');
    });

    it('offers edit and delete, with edit reporting it is collapsed', () => {
      expect(buttonNamed('Edit Speed binding').getAttribute('aria-expanded')).toBe('false');
      expect(buttonNamed('Delete Speed binding')).toBeTruthy();
    });

    it('shows no editing controls', () => {
      expect(root().querySelector('[role="radiogroup"]')).toBeNull();
      expect(amountInput()).toBeNull();
    });

    it('emits editToggle from the edit button', () => {
      buttonNamed('Edit Speed binding').click();

      expect(editToggles).toBe(1);
    });

    it('emits deleteBinding from the delete icon', () => {
      buttonNamed('Delete Speed binding').click();

      expect(deletes).toBe(1);
    });
  });

  describe('expanded', () => {
    beforeEach(() => setModel({ expanded: true }));

    it('reports the edit button as expanded', () => {
      expect(buttonNamed('Edit Speed binding').getAttribute('aria-expanded')).toBe('true');
    });

    it('replaces the style chip with a Style radio group showing the current style', () => {
      const group = root().querySelector('[role="radiogroup"]');
      const checked = group?.querySelector('[aria-checked="true"]');

      expect(group?.getAttribute('aria-label')).toBe('Style');
      expect(checked?.textContent?.trim()).toBe('Relative');
      expect(root().querySelector('.binding-chip')).toBeNull();
    });

    it('emits styleSelect with the chosen style', () => {
      const absolute = Array.from(root().querySelectorAll('[role="radio"]')).find(
        (radio) => radio.textContent?.trim() === 'Absolute'
      ) as HTMLButtonElement;

      absolute.click();

      expect(styles).toEqual(['absolute']);
    });

    it('emits relearn from Re-learn source', () => {
      const relearn = Array.from(root().querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Re-learn source'
      ) as HTMLButtonElement;

      relearn.click();

      expect(relearns).toBe(1);
    });

    it('emits deleteBinding from Delete', () => {
      const deleteButton = Array.from(root().querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Delete'
      ) as HTMLButtonElement;

      deleteButton.click();

      expect(deletes).toBe(1);
    });
  });

  describe('amount', () => {
    beforeEach(() => setModel({ expanded: true }));

    it('labels a native number input and carries its range and step', () => {
      const input = amountInput();
      const label = root().querySelector(`label[for="${input.id}"]`);

      expect(label?.textContent?.trim()).toBe('Amount');
      expect([input.min, input.max, input.step, input.value]).toEqual(['0.1', '10', '0.1', '1']);
    });

    it('is not shown for a style that takes no amount', () => {
      setModel({ expanded: true, amount: null });

      expect(amountInput()).toBeNull();
    });

    it('emits a valid entry on change', () => {
      enterAmount('2.5');

      expect(amounts).toEqual([2.5]);
      expect(alerts()).toEqual([]);
    });

    it('emits the boundary values', () => {
      enterAmount('0.1');
      enterAmount('10');

      expect(amounts).toEqual([0.1, 10]);
    });

    it.each([
      ['above the maximum', '11'],
      ['below the minimum', '0'],
      ['empty', ''],
      ['not a number', 'abc'],
    ])('shows an inline error and emits nothing for an entry %s', (_case, text) => {
      enterAmount(text);

      expect(amounts).toEqual([]);
      expect(alerts()).toEqual(['Enter a number from 0.1 to 10.']);
      expect(amountInput().getAttribute('aria-invalid')).toBe('true');
    });

    it('clears the error once a valid entry follows', () => {
      enterAmount('99');
      enterAmount('3');

      expect(alerts()).toEqual([]);
      expect(amounts).toEqual([3]);
      expect(amountInput().hasAttribute('aria-invalid')).toBe(false);
    });

    it('drops a stale error when the row is collapsed and expanded again', () => {
      enterAmount('99');

      setModel({ expanded: false });
      setModel({ expanded: true });

      expect(alerts()).toEqual([]);
    });
  });

  describe('status', () => {
    it('shows the status text and dims the row', () => {
      setModel({ statusText: 'Controller not connected' });

      expect(root().textContent).toContain('Controller not connected');
      expect(root().querySelector('.binding-row--dimmed')).not.toBeNull();
    });

    it('renders a live binding undimmed, with no status', () => {
      expect(root().querySelector('.binding-row--dimmed')).toBeNull();
      expect(root().querySelector('.binding-status')).toBeNull();
    });
  });
});
