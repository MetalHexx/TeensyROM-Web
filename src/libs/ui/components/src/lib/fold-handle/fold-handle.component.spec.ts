import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { FoldHandleComponent } from './fold-handle.component';

describe('FoldHandleComponent', () => {
  let fixture: ComponentFixture<FoldHandleComponent>;
  let emitted: boolean[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FoldHandleComponent] }).compileComponents();
    fixture = TestBed.createComponent(FoldHandleComponent);
    emitted = [];
    fixture.componentInstance.foldedChange.subscribe((v) => emitted.push(v));
    fixture.componentRef.setInput('label', 'File listing');
    fixture.componentRef.setInput('foldAccessibleName', 'Collapse the file listing');
    fixture.componentRef.setInput('unfoldAccessibleName', 'Expand the file listing');
    setFolded(false);
  });

  function setFolded(folded: boolean): void {
    fixture.componentRef.setInput('folded', folded);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const button = (): HTMLButtonElement => el().querySelector('button') as HTMLButtonElement;
  const label = (): HTMLElement | null => el().querySelector('.strip-label');

  it('requests a fold when pressed open', () => {
    button().click();

    expect(emitted).toEqual([true]);
  });

  it('requests an unfold when pressed folded', () => {
    setFolded(true);
    button().click();

    expect(emitted).toEqual([false]);
  });

  it('names the button, picks its icon and discloses state from folded', () => {
    expect(button().getAttribute('aria-label')).toBe('Collapse the file listing');
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().querySelector('mat-icon')?.textContent?.trim()).toBe('close');

    setFolded(true);

    expect(button().getAttribute('aria-label')).toBe('Expand the file listing');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().querySelector('mat-icon')?.textContent?.trim()).toBe('chevron_right');
  });

  it('shows the label only while folded, hidden from assistive tech', () => {
    expect(label()).toBeNull();

    setFolded(true);

    expect(label()?.textContent?.trim()).toBe('File listing');
    expect(label()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps one button element across a fold so focus stays on it', () => {
    document.body.appendChild(el());
    const before = button();
    before.focus();
    setFolded(true);

    expect(button()).toBe(before);
    expect(document.activeElement).toBe(before);
    el().remove();
  });
});
