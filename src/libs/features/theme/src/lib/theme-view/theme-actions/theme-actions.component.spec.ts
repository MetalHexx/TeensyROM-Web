import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ColorThemeStore } from '@teensyrom-nx/application';
import { APPLY_TO_ALL_DEVICES, ColorTheme, ColorThemeKind, Device } from '@teensyrom-nx/domain';
import { DropdownDialogComponent, SegmentedControlComponent } from '@teensyrom-nx/ui/components';
import { ThemeActionsComponent } from './theme-actions.component';
import { READ_ONLY_TEXT } from '../theme-texts';

const makeTheme = (id: string, name: string, kind: ColorThemeKind): ColorTheme => ({
  id,
  name,
  kind,
  parts: {
    device: { background: 0, border: 4, banner: 4, time: 10, option: 7, sources: 14, name: 13 },
  },
});

const makeDevice = (deviceId: string, name: string) => ({ deviceId, name }) as Device;

describe('ThemeActionsComponent', () => {
  let fixture: ComponentFixture<ThemeActionsComponent>;
  let el: HTMLElement;
  let selected: WritableSignal<ColorTheme | null>;
  let canSave: WritableSignal<boolean>;
  let canDelete: WritableSignal<boolean>;
  let connected: WritableSignal<Device[]>;
  let applyTarget: WritableSignal<string>;
  let canApply: WritableSignal<boolean>;
  let unchangedThemeId: WritableSignal<string | null>;
  let store: {
    connectedDevices: WritableSignal<Device[]>;
    targetDevices: WritableSignal<Device[]>;
    effectiveApplyTarget: WritableSignal<string>;
    showApplyTarget: WritableSignal<boolean>;
    canApply: WritableSignal<boolean>;
    unchangedThemeId: WritableSignal<string | null>;
    apply: ReturnType<typeof vi.fn>;
    setApplyTarget: ReturnType<typeof vi.fn>;
    themes: WritableSignal<ColorTheme[]>;
    selectedTheme: WritableSignal<ColorTheme | null>;
    canSave: WritableSignal<boolean>;
    canDelete: WritableSignal<boolean>;
    saveSelected: ReturnType<typeof vi.fn>;
    saveAs: ReturnType<typeof vi.fn>;
    deleteSelected: ReturnType<typeof vi.fn>;
  };
  let dialog: { open: ReturnType<typeof vi.fn> };

  const shippedTheme = makeTheme('tr-default', 'TR Default', ColorThemeKind.Shipped);
  const customTheme = makeTheme('c1', 'Mine', ColorThemeKind.Custom);

  beforeEach(() => {
    selected = signal<ColorTheme | null>(shippedTheme);
    canSave = signal(false);
    canDelete = signal(false);
    connected = signal<Device[]>([makeDevice('d1', 'Bench')]);
    applyTarget = signal(APPLY_TO_ALL_DEVICES);
    canApply = signal(true);
    unchangedThemeId = signal<string | null>('tr-default');
    store = {
      connectedDevices: connected,
      targetDevices: connected,
      effectiveApplyTarget: applyTarget,
      showApplyTarget: signal(false),
      canApply,
      unchangedThemeId,
      apply: vi.fn(),
      setApplyTarget: vi.fn(),
      themes: signal([shippedTheme, customTheme]),
      selectedTheme: selected,
      canSave,
      canDelete,
      saveSelected: vi.fn(),
      saveAs: vi.fn(),
      deleteSelected: vi.fn(),
    };
    dialog = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ThemeActionsComponent],
      providers: [
        { provide: ColorThemeStore, useValue: store },
        { provide: MatDialog, useValue: dialog },
        provideNoopAnimations(),
      ],
    });
    fixture = TestBed.createComponent(ThemeActionsComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  const buttonByLabel = (label: string): HTMLButtonElement => {
    const button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label)
    );
    if (!button) {
      throw new Error(`No ${label} button`);
    }
    return button;
  };

  describe('Apply', () => {
    const openApply = () => {
      const confirmed = new Subject<void>();
      const cancelled = new Subject<void>();
      const setInput = vi.fn();
      const close = vi.fn();
      dialog.open.mockReturnValue({
        componentRef: { setInput },
        componentInstance: { confirmed, cancelled },
        close,
      });
      buttonByLabel('Apply').click();
      return { confirmed, cancelled, setInput, close };
    };

    it('hides the chooser and the no-device message for one connected device', () => {
      expect(el.querySelector('lib-segmented-control')).toBeNull();
      expect(el.textContent).not.toContain('Apply to');
      expect(el.querySelector('[role="status"]')).toBeNull();
      expect(buttonByLabel('Apply').disabled).toBe(false);
    });

    it('shows the message and disables Apply with no connected device', () => {
      connected.set([]);
      canApply.set(false);
      fixture.detectChanges();

      expect(el.querySelector('[role="status"]')?.textContent).toContain(
        'Connect a TeensyROM to apply a theme.'
      );
      expect(buttonByLabel('Apply').disabled).toBe(true);
    });

    it('shows the chooser for two devices, all selected, and narrows through the store', () => {
      connected.set([makeDevice('d1', 'Bench'), makeDevice('d2', 'Desk')]);
      store.showApplyTarget.set(true);
      fixture.detectChanges();

      const chooser = fixture.debugElement.query(By.directive(SegmentedControlComponent))
        .componentInstance as SegmentedControlComponent;
      expect(chooser.selectedId()).toBe(APPLY_TO_ALL_DEVICES);
      expect(chooser.options().map((o) => o.label)).toEqual([
        'All connected devices',
        'Bench',
        'Desk',
      ]);

      chooser.optionSelect.emit('d2');
      expect(store.setApplyTarget).toHaveBeenCalledWith('d2');
    });

    it('confirms with the primary button and names the theme and the device', () => {
      const { setInput } = openApply();

      expect(setInput).toHaveBeenCalledWith('confirmColor', 'primary');
      expect(setInput).toHaveBeenCalledWith('title', 'Apply theme?');
      expect(setInput).toHaveBeenCalledWith(
        'message',
        'Applying “TR Default” resets the C64 and ends whatever it is running. This will apply the theme to Bench.'
      );
      expect(store.apply).not.toHaveBeenCalled();
    });

    it('names a device without a name by its id in the chooser and the confirmation', () => {
      connected.set([makeDevice('d1', ''), makeDevice('d2', 'Desk')]);
      store.showApplyTarget.set(true);
      fixture.detectChanges();

      const chooser = fixture.debugElement.query(By.directive(SegmentedControlComponent))
        .componentInstance as SegmentedControlComponent;
      expect(chooser.options().map((o) => o.label)).toEqual(['All connected devices', 'd1', 'Desk']);

      const { setInput } = openApply();
      expect(setInput).toHaveBeenCalledWith(
        'message',
        expect.stringContaining('This will apply the theme to d1 and Desk.')
      );
    });

    it('words edited colors for all target devices', () => {
      unchangedThemeId.set(null);
      connected.set([
        makeDevice('d1', 'A'),
        makeDevice('d2', 'B'),
        makeDevice('d3', 'C'),
      ]);
      fixture.detectChanges();

      const { setInput } = openApply();

      expect(setInput).toHaveBeenCalledWith(
        'message',
        'Applying these colors resets the C64 and ends whatever it is running. This will apply them to A, B and C.'
      );
    });

    it('applies only on confirm', () => {
      const { confirmed, close } = openApply();

      confirmed.next();

      expect(close).toHaveBeenCalled();
      expect(store.apply).toHaveBeenCalledTimes(1);
    });

    it('does not apply on cancel', () => {
      const { cancelled, close } = openApply();

      cancelled.next();

      expect(close).toHaveBeenCalled();
      expect(store.apply).not.toHaveBeenCalled();
    });
  });

  describe('Save', () => {
    it('is disabled and carries the read-only text in its accessible name for a shipped theme', () => {
      const save = buttonByLabel('Save');
      const saveAs = buttonByLabel('Save as');

      expect(save.disabled).toBe(true);
      expect(save.getAttribute('aria-label')).toBe(`Save. ${READ_ONLY_TEXT}`);
      expect(saveAs.getAttribute('aria-label')).not.toContain(READ_ONLY_TEXT);
    });

    it('calls saveSelected when enabled for a custom theme', () => {
      selected.set(customTheme);
      canSave.set(true);
      fixture.detectChanges();

      const save = el.querySelector<HTMLButtonElement>('.save-wrapper button');
      expect(save?.getAttribute('aria-label')).not.toContain(READ_ONLY_TEXT);
      save?.click();

      expect(store.saveSelected).toHaveBeenCalled();
    });
  });

  describe('Save as', () => {
    const openSaveAs = () => {
      const dropdown = fixture.debugElement.query(By.directive(DropdownDialogComponent))
        .componentInstance as DropdownDialogComponent;
      dropdown.open();
      fixture.detectChanges();
      return dropdown;
    };
    const nameDialog = () =>
      document.querySelector('lib-preset-name-dialog') as HTMLElement | null;

    const nameInput = (): HTMLInputElement => {
      const input = document.querySelector<HTMLInputElement>('lib-preset-name-dialog input');
      if (!input) {
        throw new Error('Name dialog is not open');
      }
      return input;
    };

    afterEach(() => {
      fixture.debugElement
        .query(By.directive(DropdownDialogComponent))
        .componentInstance.close();
    });

    it('renders the name dialog only while open, limited to 24 characters', () => {
      expect(nameDialog()).toBeNull();

      openSaveAs();

      const dialogEl = document.querySelector('lib-preset-name-dialog');
      expect(dialogEl).not.toBeNull();
      const input = dialogEl?.querySelector('input');
      expect(input?.getAttribute('maxlength')).toBe('24');
    });

    it('suggests the currently selected name plus copy each time it opens', () => {
      const dropdown = openSaveAs();
      expect(document.querySelector<HTMLInputElement>('lib-preset-name-dialog input')?.value).toBe(
        'TR Default copy'
      );
      dropdown.close();
      fixture.detectChanges();
      expect(nameDialog()).toBeNull();

      selected.set(customTheme);
      openSaveAs();

      expect(document.querySelector<HTMLInputElement>('lib-preset-name-dialog input')?.value).toBe(
        'Mine copy'
      );
    });

    it('blocks saving a taken name in the open dialog', () => {
      openSaveAs();
      const input = nameInput();
      const saveButton = () =>
        document.querySelector<HTMLButtonElement>('lib-preset-name-dialog button[aria-label="Save theme"]');
      expect(saveButton()?.disabled).toBe(false);

      input.value = 'tr default';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(saveButton()?.disabled).toBe(true);
    });

    it('saves under the confirmed name and closes', () => {
      openSaveAs();
      const input = document.querySelector<HTMLInputElement>('lib-preset-name-dialog input');
      input.value = 'Fresh';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      nameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(store.saveAs).toHaveBeenCalledWith('Fresh');
      expect(nameDialog()).toBeNull();
    });
  });

  describe('Delete', () => {
    it('is disabled when the store forbids deleting', () => {
      expect(buttonByLabel('Delete').disabled).toBe(true);
    });

    it('opens the red confirmation naming the theme, and deletes on confirm', () => {
      selected.set(customTheme);
      canDelete.set(true);
      fixture.detectChanges();
      const confirmed = new Subject<void>();
      const cancelled = new Subject<void>();
      const setInput = vi.fn();
      const close = vi.fn();
      dialog.open.mockReturnValue({
        componentRef: { setInput },
        componentInstance: { confirmed, cancelled },
        close,
      });

      buttonByLabel('Delete').click();

      expect(setInput).toHaveBeenCalledWith('confirmColor', 'error');
      expect(setInput).toHaveBeenCalledWith(
        'message',
        '“Mine” will be deleted. This cannot be undone.'
      );
      expect(dialog.open.mock.calls[0][1]).toMatchObject({ disableClose: true });

      confirmed.next();
      expect(close).toHaveBeenCalled();
      expect(store.deleteSelected).toHaveBeenCalled();
    });

    it('closes without deleting on cancel', () => {
      selected.set(customTheme);
      canDelete.set(true);
      fixture.detectChanges();
      const cancelled = new Subject<void>();
      const close = vi.fn();
      dialog.open.mockReturnValue({
        componentRef: { setInput: vi.fn() },
        componentInstance: { confirmed: new Subject<void>(), cancelled },
        close,
      });

      buttonByLabel('Delete').click();
      cancelled.next();

      expect(close).toHaveBeenCalled();
      expect(store.deleteSelected).not.toHaveBeenCalled();
    });
  });
});
