import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { C64ColorPickerComponent } from './c64-color-picker.component';

describe('C64ColorPickerComponent', () => {
  let fixture: ComponentFixture<C64ColorPickerComponent>;
  let emitted: number[];

  beforeEach(async () => {
  // jsdom has no layout, so CDK's focus trap sees every element as hidden and skips it.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    await TestBed.configureTestingModule({
      imports: [C64ColorPickerComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(C64ColorPickerComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('value', 6);
    fixture.componentRef.setInput('label', 'Background');
    fixture.detectChanges();
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((index) => emitted.push(index));
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    vi.restoreAllMocks();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.trigger');
  }

  function options(): HTMLButtonElement[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  }

  async function open(): Promise<void> {
    trigger().focus();
    trigger().click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('radio'));
  }

  function press(key: string): void {
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function focusedName(): string | undefined {
    return document.activeElement?.querySelector('.option-name')?.textContent ?? undefined;
  }

  it('names the trigger after the slot and the current color', () => {
    expect(trigger().getAttribute('aria-label')).toBe('Background color: Blue. Change');
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a radio group of sixteen named colors with the current one checked and focused', async () => {
    await open();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Choose a color for Background'
    );
    expect(options()).toHaveLength(16);
    expect(options().filter((o) => o.getAttribute('aria-checked') === 'true').map((o) => o.textContent)).toEqual([
      expect.stringContaining('Blue'),
    ]);
    expect(options().map((o) => o.tabIndex).filter((t) => t === 0)).toHaveLength(1);
    expect(focusedName()).toBe('Blue');
  });

  it('moves focus by one with Left/Right, by a row with Up/Down, and clamps at the ends', async () => {
    await open();

    press('ArrowRight');
    expect(focusedName()).toBe('Yellow');
    press('ArrowDown');
    expect(focusedName()).toBe('Dark Grey');
    press('ArrowDown');
    expect(focusedName()).toBe('Light Grey');
    press('ArrowDown');
    expect(focusedName()).toBe('Light Grey');
    press('ArrowLeft');
    expect(focusedName()).toBe('Light Blue');
    press('ArrowUp');
    expect(focusedName()).toBe('Light Red');
    press('Home');
    expect(focusedName()).toBe('Black');
    press('ArrowLeft');
    press('ArrowUp');
    expect(focusedName()).toBe('Black');
    press('End');
    expect(focusedName()).toBe('Light Grey');
  });

  it('emits the chosen index, closes, and returns focus to the trigger', async () => {
    await open();
    press('ArrowRight');

    (document.activeElement as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted).toEqual([7]);
    expect(options()).toHaveLength(0);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('closes without emitting when the current color is chosen again', async () => {
    await open();

    (document.activeElement as HTMLButtonElement).click();

    expect(emitted).toEqual([]);
    expect(options()).toHaveLength(0);
  });

  it('closes on Escape without choosing and returns focus to the trigger', async () => {
    await open();
    press('ArrowRight');

    press('Escape');

    expect(emitted).toEqual([]);
    expect(options()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
  });

  it('does not open when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    trigger().click();
    fixture.detectChanges();

    expect(trigger().disabled).toBe(true);
    expect(options()).toHaveLength(0);
  });
});
