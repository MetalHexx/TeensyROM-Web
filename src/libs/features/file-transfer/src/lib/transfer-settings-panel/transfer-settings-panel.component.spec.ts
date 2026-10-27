import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, switchMap, throwError, timer } from 'rxjs';
import { vi } from 'vitest';
import { DeviceStore, SettingsStore } from '@teensyrom-nx/application';
import {
  Device,
  ISettingsService,
  PlayerFilterType,
  SETTINGS_SERVICE,
  Settings,
  StorageType,
  WATCH_FOLDER_SERVICE,
  WatchFolder,
  WatchFolderField,
  WatchFolderRejectedError,
  WatchFolderState,
} from '@teensyrom-nx/domain';
import { TransferSettingsPanelComponent } from './transfer-settings-panel.component';

const folder = (id: string, overrides: Partial<WatchFolder> = {}): WatchFolder => ({
  id,
  path: `C:\\Watch\\${id}`,
  enabled: true,
  state: WatchFolderState.Watching,
  destinations: [
    {
      id: `${id}-1`,
      deviceId: 'dev-1',
      deviceName: 'Rack TeensyROM',
      storageType: StorageType.Sd,
      path: '/auto-transfer',
      launch: true,
    },
  ],
  ...overrides,
});

const device = (deviceId: string, name: string, usb: boolean): Device =>
  ({
    deviceId,
    name,
    sdStorage: { available: true },
    usbStorage: { available: usb },
  }) as unknown as Device;

const rackDevice = device('dev-1', 'Rack TeensyROM', false);
const benchDevice = device('dev-2', 'Bench TeensyROM', true);

const settings = (autoLaunch = false): Settings =>
  ({
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: false,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: PlayerFilterType.All,
      startupLaunchEnabled: false,
      startupLaunchRandom: false,
    },
    fileTransferSettings: { autoLaunchOnCopyEnabled: autoLaunch },
    searchSettings: {
      weights: {
        nameWeight: 1,
        titleWeight: 1,
        creatorWeight: 1,
        releaseInfoWeight: 1,
        descriptionWeight: 1,
      },
      stopWords: [],
      bannedDirectories: [],
      bannedFiles: [],
    },
    appSettings: { setupCompleted: true },
    knownDevices: [],
  }) as unknown as Settings;

describe('TransferSettingsPanelComponent', () => {
  let fixture: ComponentFixture<TransferSettingsPanelComponent>;
  let settingsService: { getSettings: ReturnType<typeof vi.fn>; saveSettings: ReturnType<typeof vi.fn> };
  let watchFolders: Record<string, ReturnType<typeof vi.fn>>;
  let settingsStore: InstanceType<typeof SettingsStore>;
  let initialFolders: WatchFolder[];

  const native = () => fixture.nativeElement as HTMLElement;
  const query = <T extends HTMLElement>(testId: string) =>
    native().querySelector<T>(`[data-testid="${testId}"]`);
  const queryAll = (testId: string) =>
    Array.from(native().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const clickButton = (host: HTMLElement | null | undefined) =>
    host?.querySelector('button')?.click();
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const setup = async (options: { folders?: WatchFolder[]; withSettings?: boolean } = {}) => {
    initialFolders = options.folders ?? [];
    settingsService = {
      getSettings: vi.fn().mockReturnValue(of(settings())),
      saveSettings: vi.fn().mockReturnValue(of(undefined)),
    };
    watchFolders = {
      list: vi.fn().mockImplementation(async () => initialFolders),
      add: vi.fn(),
      setDestination: vi.fn(),
      setEnabled: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
      removeDestination: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TransferSettingsPanelComponent],
      providers: [
        provideNoopAnimations(),
        { provide: SETTINGS_SERVICE, useValue: settingsService as unknown as ISettingsService },
        { provide: WATCH_FOLDER_SERVICE, useValue: watchFolders },
        { provide: DeviceStore, useValue: { usableDevices: signal([rackDevice, benchDevice]) } },
      ],
    }).compileComponents();

    settingsStore = TestBed.inject(SettingsStore);
    if (options.withSettings !== false) {
      await settingsStore.loadSettings();
    }

    fixture = TestBed.createComponent(TransferSettingsPanelComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();
  };

  afterEach(() => fixture?.destroy());

  describe('global auto-launch', () => {
    it('reflects the stored setting', async () => {
      await setup();
      expect(query('auto-launch-switch')?.querySelector('button')?.getAttribute('aria-checked')).toBe(
        'false'
      );

      settingsStore.updateSettings({
        settings: { fileTransferSettings: { autoLaunchOnCopyEnabled: true } },
      });
      await settle();

      expect(query('auto-launch-switch')?.querySelector('button')?.getAttribute('aria-checked')).toBe(
        'true'
      );
    });

    it('updates the setting and saves it when toggled', async () => {
      await setup();

      query('auto-launch-switch')?.querySelector('button')?.click();
      await settle();

      expect(settingsStore.getSettings()()?.fileTransferSettings.autoLaunchOnCopyEnabled).toBe(true);
      expect(settingsService.saveSettings).toHaveBeenCalledTimes(1);
      expect(settingsService.saveSettings.mock.calls[0][0].fileTransferSettings).toEqual({
        autoLaunchOnCopyEnabled: true,
      });
    });

    it('shows the failure and puts the switch back when the save fails', async () => {
      await setup();
      settingsService.saveSettings.mockImplementation(() =>
        timer(0).pipe(switchMap(() => throwError(() => new Error('Engine offline'))))
      );

      query('auto-launch-switch')?.querySelector('button')?.click();
      await settle();
      await settle();

      expect(query('settings-error')?.textContent).toContain('Engine offline');
      expect(settingsStore.getSettings()()?.fileTransferSettings.autoLaunchOnCopyEnabled).toBe(false);
      expect(query('auto-launch-switch')?.querySelector('button')?.getAttribute('aria-checked')).toBe(
        'false'
      );
    });

    it('is disabled while settings have not loaded', async () => {
      await setup({ withSettings: false });

      expect(query('auto-launch-switch')?.querySelector('button')?.disabled).toBe(true);
    });
  });

  describe('watch folder list', () => {
    it('loads the list each time the panel opens', async () => {
      await setup({ folders: [folder('a')] });
      expect(watchFolders['list']).toHaveBeenCalledTimes(1);

      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      initialFolders = [folder('a'), folder('b')];
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      await settle();

      expect(watchFolders['list']).toHaveBeenCalledTimes(2);
      expect(queryAll('watch-folder')).toHaveLength(2);
    });

    it('shows the empty state when there are no folders', async () => {
      await setup();

      expect(query('watch-folders-empty')?.textContent).toContain('No watch folders yet');
    });

    it('shows each folder with its path, switch and device rows', async () => {
      await setup({ folders: [folder('a'), folder('b')] });

      expect(queryAll('watch-folder')).toHaveLength(2);
      const path = query('watch-folder-path');
      expect(path?.getAttribute('title')).toBe('C:\\Watch\\a');
      expect(path?.textContent).toContain('C:\\Watch\\a');
      expect(queryAll('watch-folder-device-name')[0].textContent).toBe('Rack TeensyROM');
      expect(queryAll('watch-folder-device-target')[0].textContent).toContain('SD /auto-transfer');
      expect(queryAll('watch-folder-device-launch')).toHaveLength(2);
    });

    it('falls back to the device id and omits the Launch tag when launch is off', async () => {
      const f = folder('a');
      f.destinations[0] = { ...f.destinations[0], deviceName: null, launch: false };
      await setup({ folders: [f] });

      expect(query('watch-folder-device-name')?.textContent).toBe('dev-1');
      expect(query('watch-folder-device-launch')).toBeNull();
    });

    it('dims an off folder and leaves a watching folder undimmed', async () => {
      await setup({
        folders: [folder('a'), folder('b', { enabled: false, state: WatchFolderState.Off })],
      });

      const [watching, off] = queryAll('watch-folder');
      expect(watching.classList.contains('folder-block--off')).toBe(false);
      expect(off.classList.contains('folder-block--off')).toBe(true);
    });

    it('notes an unavailable folder', async () => {
      await setup({
        folders: [folder('a', { state: WatchFolderState.Unavailable }), folder('b')],
      });

      const notes = queryAll('watch-folder-unavailable');
      expect(notes).toHaveLength(1);
      expect(notes[0].textContent).toContain('Unavailable');
    });

    it('shows a list-level error', async () => {
      await setup();
      watchFolders['list'].mockRejectedValue(new Error('engine down'));

      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      await settle();

      expect(query('watch-folders-error')?.textContent).toContain('engine down');
    });

    it('gives every icon-only button an accessible name', async () => {
      await setup({ folders: [folder('a')] });

      const buttons = Array.from(native().querySelectorAll('button')).filter(
        (b) => !b.closest('mat-slide-toggle')
      );
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((button) => {
        const name = button.getAttribute('aria-label') ?? button.textContent?.trim();
        expect(name).toBeTruthy();
      });
    });
  });

  describe('changes', () => {
    it('switches a folder off through the store and updates its row', async () => {
      await setup({ folders: [folder('a')] });
      watchFolders['setEnabled'].mockResolvedValue(
        folder('a', { enabled: false, state: WatchFolderState.Off })
      );

      query('watch-folder-switch')?.querySelector('button')?.click();
      await settle();

      expect(watchFolders['setEnabled']).toHaveBeenCalledWith('a', false);
      expect(query('watch-folder')?.classList.contains('folder-block--off')).toBe(true);
    });

    it('keeps the switch where it was when the engine refuses the change', async () => {
      await setup({ folders: [folder('a')] });
      watchFolders['setEnabled'].mockRejectedValue(new Error('Watch folder not found'));

      query('watch-folder-switch')?.querySelector('button')?.click();
      await settle();

      expect(query('watch-folders-error')?.textContent).toContain('Watch folder not found');
      expect(
        query('watch-folder-switch')?.querySelector('button')?.getAttribute('aria-checked')
      ).toBe('true');
    });

    it('asks before removing a folder, then removes it', async () => {
      await setup({ folders: [folder('a')] });

      clickButton(query('watch-folder-delete'));
      await settle();
      expect(watchFolders['remove']).not.toHaveBeenCalled();

      const dialog = document.querySelector('lib-confirmation-dialog');
      expect(dialog?.textContent).toContain('Stop watching this folder?');
      const confirm = Array.from(dialog?.querySelectorAll('button') ?? []).find((b) =>
        b.textContent?.includes('Stop watching')
      );
      confirm?.click();
      await settle();

      expect(watchFolders['remove']).toHaveBeenCalledWith('a');
      expect(queryAll('watch-folder')).toHaveLength(0);
    });

    it('does not remove a folder when the confirmation is cancelled', async () => {
      await setup({ folders: [folder('a')] });

      clickButton(query('watch-folder-delete'));
      await settle();
      const cancel = Array.from(
        document.querySelectorAll('lib-confirmation-dialog button')
      ).find((b) => b.textContent?.includes('Cancel')) as HTMLButtonElement | undefined;
      cancel?.click();
      await settle();

      expect(watchFolders['remove']).not.toHaveBeenCalled();
      expect(queryAll('watch-folder')).toHaveLength(1);
    });

    it('warns that removing the last device removes the folder, and drops the folder', async () => {
      await setup({ folders: [folder('a')] });
      watchFolders['removeDestination'].mockResolvedValue({ folderRemoved: true, watchFolder: null });

      clickButton(query('watch-folder-device-delete'));
      await settle();
      const dialog = document.querySelector('lib-confirmation-dialog');
      expect(dialog?.textContent).toContain('Remove this device?');
      expect(dialog?.textContent).toContain('so the folder is removed too');
      (Array.from(dialog?.querySelectorAll('button') ?? []).find((b) =>
        b.textContent?.includes('Remove')
      ) as HTMLButtonElement).click();
      await settle();

      expect(watchFolders['removeDestination']).toHaveBeenCalledWith('a', 'dev-1');
      expect(queryAll('watch-folder')).toHaveLength(0);
    });

    it('does not warn about the folder when other devices remain', async () => {
      const f = folder('a');
      f.destinations.push({ ...f.destinations[0], id: 'a-2', deviceId: 'dev-2' });
      await setup({ folders: [f] });

      clickButton(queryAll('watch-folder-device-delete')[0]);
      await settle();

      expect(document.querySelector('lib-confirmation-dialog')?.textContent).not.toContain(
        'so the folder is removed too'
      );
    });
  });

  describe('forms', () => {
    const type = async (testId: string, value: string) => {
      const input = query<HTMLInputElement>(testId);
      if (!input) throw new Error(`No field ${testId}`);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle();
    };
    const optionLabels = () =>
      Array.from(document.querySelectorAll('mat-option')).map((o) => o.textContent?.trim());
    const openSelect = async (testId: string) => {
      query(testId)?.querySelector<HTMLElement>('.mat-mdc-select-trigger')?.click();
      await settle();
    };
    const choose = async (testId: string, label: string) => {
      await openSelect(testId);
      Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
        .find((o) => o.textContent?.trim() === label)
        ?.click();
      await settle();
    };
    const submitButton = () => query('form-submit')?.querySelector('button');
    const submit = async () => {
      submitButton()?.click();
      await settle();
      await settle();
    };
    const errorText = (testId: string) => query(testId)?.textContent?.trim();
    const reject = (field: WatchFolderField | null, message: string) =>
      new WatchFolderRejectedError(400, message, field);

    const fillAddFolder = async () => {
      clickButton(query('add-watch-folder'));
      await settle();
      await type('form-folder', '  D:\\Incoming  ');
      await choose('form-device', 'Bench TeensyROM');
    };

    describe('add folder', () => {
      it('gates Add on the required fields and defaults the device folder and launch', async () => {
        await setup();
        clickButton(query('add-watch-folder'));
        await settle();

        expect(query<HTMLInputElement>('form-device-path')?.value).toBe('/auto-transfer');
        expect(submitButton()?.disabled).toBe(true);

        await type('form-folder', '   ');
        expect(submitButton()?.disabled).toBe(true);

        await type('form-folder', 'D:\\Incoming');
        expect(submitButton()?.disabled).toBe(true);

        await choose('form-device', 'Bench TeensyROM');
        expect(submitButton()?.disabled).toBe(false);
      });

      it('offers only the storage the chosen device has', async () => {
        await setup();
        clickButton(query('add-watch-folder'));
        await settle();

        await choose('form-device', 'Rack TeensyROM');
        await openSelect('form-storage');
        expect(optionLabels()).toEqual(['SD']);
      });

      it('saves the trimmed folder and the chosen device, then closes and lists it', async () => {
        await setup();
        watchFolders['add'].mockResolvedValue(
          folder('new', {
            path: 'D:\\Incoming',
            destinations: [
              {
                id: 'new-1',
                deviceId: 'dev-2',
                deviceName: 'Bench TeensyROM',
                storageType: StorageType.Sd,
                path: '/auto-transfer',
                launch: false,
              },
            ],
          })
        );

        await fillAddFolder();
        await submit();

        expect(watchFolders['add']).toHaveBeenCalledWith({
          path: 'D:\\Incoming',
          deviceId: 'dev-2',
          storageType: StorageType.Sd,
          devicePath: '/auto-transfer',
          launch: false,
        });
        expect(query('watch-folder-form')).toBeNull();
        expect(query('watch-folder-path')?.textContent).toContain('D:\\Incoming');
        expect(query('add-watch-folder')?.contains(document.activeElement)).toBe(true);
      });

      it('moves focus to the folder field on open', async () => {
        await setup();
        clickButton(query('add-watch-folder'));
        await settle();

        expect(document.activeElement).toBe(query('form-folder'));
      });

      it.each([
        ['folder', 'error-folder'],
        ['device', 'error-device'],
        ['storage', 'error-storage'],
        ['devicePath', 'error-device-path'],
      ] as const)(
        'shows a %s refusal under that field and keeps the form with its values',
        async (field, errorId) => {
          await setup();
          watchFolders['add'].mockRejectedValue(reject(field, `Refused ${field}`));

          await fillAddFolder();
          await submit();

          expect(errorText(errorId)).toBe(`Refused ${field}`);
          expect(query('error-form')).toBeNull();
          expect(query<HTMLInputElement>('form-folder')?.value).toBe('  D:\\Incoming  ');
          expect(submitButton()?.disabled).toBe(false);
        }
      );

      it('shows a refusal that concerns no field above the buttons', async () => {
        await setup();
        watchFolders['add'].mockRejectedValue(reject(null, 'Engine unavailable'));

        await fillAddFolder();
        await submit();

        expect(errorText('error-form')).toBe('Engine unavailable');
        expect(query('error-folder')).toBeNull();
        expect(query('watch-folder-form')).not.toBeNull();
      });

      it('clears the refusal once a value changes', async () => {
        await setup();
        watchFolders['add'].mockRejectedValue(reject('folder', 'Not found'));

        await fillAddFolder();
        await submit();
        await type('form-folder', 'D:\\Other');

        expect(query('error-folder')).toBeNull();
      });

      it('cancels on the Cancel button and on Escape, returning focus to the add button', async () => {
        await setup();
        clickButton(query('add-watch-folder'));
        await settle();
        clickButton(query('form-cancel'));
        await settle();
        expect(query('watch-folder-form')).toBeNull();
        expect(query('add-watch-folder')?.contains(document.activeElement)).toBe(true);

        clickButton(query('add-watch-folder'));
        await settle();
        query('form-folder')?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        await settle();
        expect(query('watch-folder-form')).toBeNull();
      });
    });

    describe('add device', () => {
      it('offers only connected devices not already on the folder', async () => {
        await setup({ folders: [folder('a')] });
        query<HTMLButtonElement>('add-device')?.click();
        await settle();

        await openSelect('form-device');
        expect(optionLabels()).toEqual(['Bench TeensyROM']);
      });

      it('saves through add with the folder path and closes', async () => {
        await setup({ folders: [folder('a')] });
        watchFolders['add'].mockResolvedValue(
          folder('a', {
            destinations: [
              ...folder('a').destinations,
              {
                id: 'a-2',
                deviceId: 'dev-2',
                deviceName: 'Bench TeensyROM',
                storageType: StorageType.Usb,
                path: '/auto-transfer',
                launch: false,
              },
            ],
          })
        );
        query<HTMLButtonElement>('add-device')?.click();
        await settle();

        await choose('form-device', 'Bench TeensyROM');
        await choose('form-storage', 'USB');
        await submit();

        expect(watchFolders['add']).toHaveBeenCalledWith({
          path: 'C:\\Watch\\a',
          deviceId: 'dev-2',
          storageType: StorageType.Usb,
          devicePath: '/auto-transfer',
          launch: false,
        });
        expect(query('watch-folder-device-form')).toBeNull();
        expect(queryAll('watch-folder-device-row')).toHaveLength(2);
        expect(query('add-device')?.contains(document.activeElement)).toBe(true);
      });

      it('shows a refusal under its field and keeps the form open', async () => {
        await setup({ folders: [folder('a')] });
        watchFolders['add'].mockRejectedValue(reject('devicePath', 'Not a valid device folder'));
        query<HTMLButtonElement>('add-device')?.click();
        await settle();

        await choose('form-device', 'Bench TeensyROM');
        await submit();

        expect(errorText('error-device-path')).toBe('Not a valid device folder');
        expect(query('watch-folder-device-form')).not.toBeNull();
      });

      it('shows a refusal about the folder above the buttons', async () => {
        await setup({ folders: [folder('a')] });
        watchFolders['add'].mockRejectedValue(reject('folder', 'Folder is gone'));
        query<HTMLButtonElement>('add-device')?.click();
        await settle();

        await choose('form-device', 'Bench TeensyROM');
        await submit();

        expect(errorText('error-form')).toBe('Folder is gone');
      });
    });

    describe('edit device', () => {
      const openEdit = async () => {
        await setup({ folders: [folder('a')] });
        clickButton(query('watch-folder-device-edit'));
        await settle();
      };

      it('replaces the row with a form that shows device and storage read-only, with the note', async () => {
        await openEdit();

        expect(queryAll('watch-folder-device-row')).toHaveLength(0);
        expect(query<HTMLInputElement>('form-device-readonly')?.value).toBe('Rack TeensyROM');
        expect(query<HTMLInputElement>('form-storage-readonly')?.value).toBe('SD');
        expect(query('form-readonly-note')?.textContent).toContain('remove this and add it again');
        expect(query<HTMLInputElement>('form-device-path')?.value).toBe('/auto-transfer');
        expect(document.activeElement).toBe(query('form-device-path'));
      });

      it('sends only the changed field', async () => {
        await openEdit();
        watchFolders['setDestination'].mockResolvedValue(folder('a'));

        await type('form-device-path', '/games');
        await submit();

        expect(watchFolders['setDestination']).toHaveBeenCalledWith('a', 'dev-1', {
          devicePath: '/games',
        });
        expect(query('watch-folder-device-form')).toBeNull();
        expect(queryAll('watch-folder-device-row')).toHaveLength(1);
        expect(query('watch-folder-device-edit')?.contains(document.activeElement)).toBe(true);
      });

      it('sends the launch switch when it is toggled', async () => {
        await openEdit();
        watchFolders['setDestination'].mockResolvedValue(folder('a'));

        query('form-launch')?.querySelector('button')?.click();
        await settle();
        await submit();

        expect(watchFolders['setDestination']).toHaveBeenCalledWith('a', 'dev-1', {
          launch: false,
        });
      });

      it('closes without a request when nothing changed', async () => {
        await openEdit();

        await submit();

        expect(watchFolders['setDestination']).not.toHaveBeenCalled();
        expect(query('watch-folder-device-form')).toBeNull();
      });

      it('shows a refusal under the device folder and keeps the form open', async () => {
        await openEdit();
        watchFolders['setDestination'].mockRejectedValue(reject('devicePath', 'Bad path'));

        await type('form-device-path', '/x');
        await submit();

        expect(errorText('error-device-path')).toBe('Bad path');
        expect(query<HTMLInputElement>('form-device-path')?.value).toBe('/x');
      });
    });

    it('keeps one form open at a time', async () => {
      await setup({ folders: [folder('a'), folder('b')] });

      clickButton(query('add-watch-folder'));
      await settle();
      expect(query('watch-folder-form')).not.toBeNull();

      queryAll('add-device')[0].click();
      await settle();
      expect(query('watch-folder-form')).toBeNull();
      expect(queryAll('watch-folder-device-form')).toHaveLength(1);

      clickButton(queryAll('watch-folder-device-edit')[1]);
      await settle();
      expect(queryAll('watch-folder-device-form')).toHaveLength(1);
      expect(query('form-device-readonly')).not.toBeNull();
    });
  });

  it('moves focus to the Global switch', async () => {
    await setup();

    fixture.componentInstance.focusEntry();

    expect(native().contains(document.activeElement)).toBe(true);
    expect(query('auto-launch-switch')?.contains(document.activeElement)).toBe(true);
  });
});
