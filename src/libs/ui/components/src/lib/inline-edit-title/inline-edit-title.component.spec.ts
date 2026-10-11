import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { InlineEditTitleComponent } from './inline-edit-title.component';

/** A parent that wires `saving` and `value` the way a real consumer does, from its `commit` handler. */
@Component({
  imports: [InlineEditTitleComponent],
  template: `<lib-inline-edit-title
    [value]="name()"
    [saving]="saving()"
    (commit)="onCommit($event)"
  />`,
})
class SavingHostComponent {
  readonly name = signal('TR-1');
  readonly saving = signal(false);
  committed: string | null = null;

  onCommit(next: string): void {
    this.committed = next;
    this.saving.set(true);
  }

  /** Ends the save: the new name lands when it succeeded, the old one stays when it failed. */
  settle(succeeded: boolean): void {
    if (succeeded && this.committed !== null) {
      this.name.set(this.committed);
    }
    this.saving.set(false);
  }
}

describe('InlineEditTitleComponent', () => {
  let fixture: ComponentFixture<InlineEditTitleComponent>;
  let commitSpy: ReturnType<typeof vi.fn>;

  const notBlank = (draft: string) => draft.trim().length > 0;

  const titleButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('button.title');
  const field = (): HTMLInputElement | null => fixture.nativeElement.querySelector('input');

  const startEditing = (): HTMLInputElement => {
    titleButton().click();
    fixture.detectChanges();
    return field() as HTMLInputElement;
  };

  const type = (input: HTMLInputElement, text: string): void => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const press = (input: HTMLInputElement, key: string): void => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InlineEditTitleComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(InlineEditTitleComponent);
    fixture.componentRef.setInput('value', 'TR-1');
    fixture.componentRef.setInput('isValid', notBlank);
    fixture.componentRef.setInput('editLabel', 'Rename TR-1');
    fixture.componentRef.setInput('invalidDescription', 'Name is required.');
    commitSpy = vi.fn();
    fixture.componentInstance.commit.subscribe(commitSpy);
    fixture.detectChanges();
  });

  describe('resting state', () => {
    it('shows the value on a button with the edit label as its accessible name', () => {
      expect(titleButton().textContent).toContain('TR-1');
      expect(titleButton().getAttribute('aria-label')).toBe('Rename TR-1');
      expect(field()).toBeNull();
    });

    it('shows a value that changes from outside', () => {
      fixture.componentRef.setInput('value', 'Studio');
      fixture.detectChanges();

      expect(titleButton().textContent).toContain('Studio');
    });
  });

  describe('entering edit mode', () => {
    it('opens a focused field holding the value, selected, with the same accessible name', () => {
      const input = startEditing();

      expect(input.value).toBe('TR-1');
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);
      expect(input.getAttribute('aria-label')).toBe('Rename TR-1');
    });

    it('names the field from the value when no edit label is supplied, leaving the button to its own text', () => {
      fixture.componentRef.setInput('editLabel', '');
      fixture.detectChanges();

      expect(titleButton().getAttribute('aria-label')).toBeNull();
      expect(startEditing().getAttribute('aria-label')).toBe('Edit TR-1');
    });

    it('applies maxlength and shows the counter', () => {
      fixture.componentRef.setInput('maxLength', 12);
      const input = startEditing();

      expect(input.getAttribute('maxlength')).toBe('12');
      expect(fixture.nativeElement.querySelector('.counter').textContent.trim()).toBe('4/12');

      type(input, 'Studio');
      expect(fixture.nativeElement.querySelector('.counter').textContent.trim()).toBe('6/12');
    });
  });

  describe('saving', () => {
    beforeEach(() => {
      fixture.componentInstance.commit.subscribe(() =>
        fixture.componentRef.setInput('saving', true)
      );
    });

    const commitStudio = (key = 'Enter'): HTMLInputElement => {
      const input = startEditing();
      type(input, 'Studio');
      if (key === 'blur') {
        input.dispatchEvent(new Event('blur'));
        fixture.detectChanges();
      } else {
        press(input, key);
      }
      return input;
    };

    const settle = (value: string): void => {
      fixture.componentRef.setInput('value', value);
      fixture.componentRef.setInput('saving', false);
      fixture.detectChanges();
    };

    it('keeps the field open, disabled and showing the typed name while the commit is saving', () => {
      const input = commitStudio();

      expect(field()).toBe(input);
      expect(input.disabled).toBe(true);
      expect(input.value).toBe('Studio');
      expect(fixture.nativeElement.querySelector('.counter').textContent.trim()).toBe('6/24');
      expect(commitSpy).toHaveBeenCalledExactlyOnceWith('Studio');
    });

    it('closes onto the saved name as the plain title when the save lands', () => {
      commitStudio();
      settle('Studio');

      expect(field()).toBeNull();
      expect(titleButton().textContent).toContain('Studio');
      expect(titleButton().classList).not.toContain('is-editing');
      expect(document.activeElement).not.toBe(titleButton());
    });

    it('closes back onto the old name when the save fails', () => {
      commitStudio();
      fixture.componentRef.setInput('saving', false);
      fixture.detectChanges();

      expect(field()).toBeNull();
      expect(titleButton().textContent).toContain('TR-1');
    });

    it('does not offer a second edit or a second commit while saving', () => {
      const input = commitStudio();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(titleButton().classList).toContain('is-editing');
    });

    it('does not take focus back after a commit made by leaving the field', () => {
      commitStudio('blur');
      settle('Studio');

      expect(field()).toBeNull();
      expect(document.activeElement).not.toBe(titleButton());
    });
  });

  describe('saving handed off by a real parent', () => {
    let hostFixture: ComponentFixture<SavingHostComponent>;
    let host: SavingHostComponent;

    const hostField = (): HTMLInputElement | null =>
      hostFixture.nativeElement.querySelector('input');
    const hostButton = (): HTMLButtonElement =>
      hostFixture.nativeElement.querySelector('button.title');

    const commitStudio = (): HTMLInputElement => {
      hostButton().click();
      hostFixture.detectChanges();
      const input = hostField() as HTMLInputElement;
      input.value = 'Studio';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      hostFixture.detectChanges();
      return input;
    };

    beforeEach(() => {
      hostFixture = TestBed.createComponent(SavingHostComponent);
      host = hostFixture.componentInstance;
      hostFixture.detectChanges();
    });

    it('holds the field open and disabled on the typed name while the parent is saving', () => {
      const input = commitStudio();

      expect(host.committed).toBe('Studio');
      expect(hostField()).toBe(input);
      expect(input.disabled).toBe(true);
      expect(input.value).toBe('Studio');
    });

    it('returns to the plain title showing the new name when the parent finishes saving', () => {
      commitStudio();
      host.settle(true);
      hostFixture.detectChanges();

      expect(hostField()).toBeNull();
      expect(hostButton().textContent).toContain('Studio');
      expect(document.activeElement).not.toBe(hostButton());
    });

    it('returns to the plain title showing the old name when the parent save fails', () => {
      commitStudio();
      host.settle(false);
      hostFixture.detectChanges();

      expect(hostField()).toBeNull();
      expect(hostButton().textContent).toContain('TR-1');
      expect(document.activeElement).not.toBe(hostButton());
    });
  });

  describe('Enter', () => {
    it('commits the trimmed draft when it is valid and changed, then returns to the plain title', () => {
      const input = startEditing();
      type(input, '  Studio  ');
      press(input, 'Enter');

      expect(commitSpy).toHaveBeenCalledExactlyOnceWith('Studio');
      expect(field()).toBeNull();
      expect(titleButton().classList).not.toContain('is-editing');
      expect(document.activeElement).not.toBe(titleButton());
    });

    it('exits to the plain title without committing when the trimmed draft equals the value', () => {
      const input = startEditing();
      type(input, ' TR-1 ');
      press(input, 'Enter');

      expect(commitSpy).not.toHaveBeenCalled();
      expect(field()).toBeNull();
      expect(document.activeElement).not.toBe(titleButton());
    });

    it('keeps the field open and flags it when the draft is invalid', () => {
      const input = startEditing();
      type(input, '   ');
      press(input, 'Enter');

      expect(commitSpy).not.toHaveBeenCalled();
      expect(field()).toBe(input);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(fixture.nativeElement.querySelector('.field').classList).toContain('invalid');

      const describedBy = input.getAttribute('aria-describedby') as string;
      expect(fixture.nativeElement.querySelector(`#${describedBy}`).textContent.trim()).toBe(
        'Name is required.'
      );
    });

    it('clears the invalid flag once the draft becomes valid again', () => {
      const input = startEditing();
      type(input, '');
      press(input, 'Enter');
      type(input, 'Studio');

      expect(input.getAttribute('aria-invalid')).toBeNull();
      expect(input.getAttribute('aria-describedby')).toBeNull();
    });

    it('ignores the Enter that confirms an IME composition', () => {
      const input = startEditing();
      type(input, 'Studio');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
      fixture.detectChanges();

      expect(commitSpy).not.toHaveBeenCalled();
      expect(field()).toBe(input);
    });
  });

  describe('Escape', () => {
    it('reverts to the plain title and emits nothing', () => {
      const input = startEditing();
      type(input, 'Studio');
      press(input, 'Escape');

      expect(commitSpy).not.toHaveBeenCalled();
      expect(field()).toBeNull();
      expect(titleButton().textContent).toContain('TR-1');
      expect(document.activeElement).not.toBe(titleButton());
    });

    it('starts the next edit from the committed value, not the abandoned draft', () => {
      const input = startEditing();
      type(input, 'Studio');
      press(input, 'Escape');

      expect(startEditing().value).toBe('TR-1');
    });
  });

  describe('blur', () => {
    it('commits a valid changed draft', () => {
      const input = startEditing();
      type(input, 'Studio');
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(commitSpy).toHaveBeenCalledExactlyOnceWith('Studio');
      expect(field()).toBeNull();
    });

    it('reverts an invalid draft without committing', () => {
      const input = startEditing();
      type(input, '   ');
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(commitSpy).not.toHaveBeenCalled();
      expect(field()).toBeNull();
      expect(titleButton().textContent).toContain('TR-1');
    });

    it('reverts an unchanged draft without committing', () => {
      const input = startEditing();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(commitSpy).not.toHaveBeenCalled();
      expect(field()).toBeNull();
    });

    it('does not commit a second time when the field blurs after Enter', () => {
      const input = startEditing();
      type(input, 'Studio');
      press(input, 'Enter');
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(commitSpy).toHaveBeenCalledTimes(1);
    });
  });
});
