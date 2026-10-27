import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SetHeaderComponent, type SetHeaderModel } from './set-header.component';

const header: SetHeaderModel = {
  name: 'Friday warm-up',
  nameMaxLength: 64,
  countText: '8 SIDS',
  save: 'saved',
  saveText: 'Saved',
  renameLabel: 'Rename set Friday warm-up',
  newAccessibleName: 'New set',
  deleteAccessibleName: 'Delete set Friday warm-up',
  deletePrompt: "Delete Friday warm-up? This can't be undone.",
  disabled: false,
};

describe('SetHeaderComponent', () => {
  let fixture: ComponentFixture<SetHeaderComponent>;
  let emitted: unknown[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SetHeaderComponent] }).compileComponents();
    fixture = TestBed.createComponent(SetHeaderComponent);
    emitted = [];
    fixture.componentInstance.rename.subscribe((name) => emitted.push(['rename', name]));
    fixture.componentInstance.newSet.subscribe(() => emitted.push('new'));
    fixture.componentInstance.deleteSet.subscribe(() => emitted.push('delete'));
    setModel({});
  });

  function setModel(overrides: Partial<SetHeaderModel>): void {
    fixture.componentRef.setInput('model', { ...header, ...overrides });
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const byName = (name: string): HTMLButtonElement =>
    el().querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
  const confirmKey = (part: string): HTMLButtonElement =>
    el().querySelector(`.confirm [data-part="${part}"] button`) as HTMLButtonElement;

  async function askToDelete(): Promise<void> {
    byName('Delete set Friday warm-up').click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('renames through the inline editor', () => {
    byName('Rename set Friday warm-up').click();
    fixture.detectChanges();
    const field = el().querySelector('input[type="text"]') as HTMLInputElement;
    field.value = 'Saturday set';
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitted).toEqual([['rename', 'Saturday set']]);
  });

  it('does not commit an empty name', () => {
    byName('Rename set Friday warm-up').click();
    fixture.detectChanges();
    const field = el().querySelector('input[type="text"]') as HTMLInputElement;
    field.value = '   ';
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitted).toEqual([]);
  });

  it('emits newSet from the New key', () => {
    byName('New set').click();

    expect(emitted).toEqual(['new']);
  });

  it('asks before deleting: nothing is emitted until the confirm Delete is pressed', async () => {
    await askToDelete();

    expect(el().querySelector('.confirm')?.textContent).toContain("Delete Friday warm-up? This can't be undone.");
    expect(emitted).toEqual([]);

    confirmKey('confirm-delete').click();
    fixture.detectChanges();

    expect(emitted).toEqual(['delete']);
    expect(el().querySelector('.confirm')).toBeNull();
  });

  it('moves focus to Cancel when the confirm opens', async () => {
    await askToDelete();

    expect(document.activeElement).toBe(confirmKey('cancel'));
  });

  it('cancels without emitting and returns focus to the delete key', async () => {
    await askToDelete();
    confirmKey('cancel').click();
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(el().querySelector('.confirm')).toBeNull();
    expect(document.activeElement).toBe(byName('Delete set Friday warm-up'));
  });

  it('cancels on Escape, emitting nothing, and returns focus to the delete key', async () => {
    await askToDelete();
    confirmKey('cancel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(el().querySelector('.confirm')).toBeNull();
    expect(document.activeElement).toBe(byName('Delete set Friday warm-up'));
  });

  it('shows the save state on a status lamp', () => {
    const lamp = (): HTMLElement => el().querySelector('[role="status"]') as HTMLElement;
    expect(lamp().textContent?.trim()).toBe('Saved');
    expect(lamp().getAttribute('data-save')).toBe('saved');

    setModel({ save: 'saving', saveText: 'Saving' });
    expect(lamp().textContent?.trim()).toBe('Saving');
    expect(lamp().getAttribute('data-save')).toBe('saving');

    setModel({ save: 'failed', saveText: 'Not saved' });
    expect(lamp().textContent?.trim()).toBe('Not saved');
    expect(lamp().getAttribute('data-save')).toBe('failed');
  });

  it('shows the count', () => {
    expect(el().textContent).toContain('8 SIDS');
  });

  it('disables the keys and the editor before the library is ready', () => {
    setModel({ disabled: true });

    expect(byName('New set').disabled).toBe(true);
    expect(byName('Delete set Friday warm-up').disabled).toBe(true);
    expect(el().querySelector('lib-inline-edit-title')).toBeNull();
  });
});
