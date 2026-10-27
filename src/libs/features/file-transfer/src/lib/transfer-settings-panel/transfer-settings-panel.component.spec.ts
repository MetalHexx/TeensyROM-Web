import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SettingsStore } from '@teensyrom-nx/application';
import {
  ISettingsService,
  PlayerFilterType,
  SETTINGS_SERVICE,
  Settings,
  StorageType,
  WATCH_FOLDER_SERVICE,
  WatchFolder,
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

  describe('hooks for the form', () => {
    it('emits addFolder, addDevice and editDevice', async () => {
      await setup({ folders: [folder('a')] });
      const added = vi.fn();
      const device = vi.fn();
      const edited = vi.fn();
      fixture.componentInstance.addFolder.subscribe(added);
      fixture.componentInstance.addDevice.subscribe(device);
      fixture.componentInstance.editDevice.subscribe(edited);

      clickButton(query('add-watch-folder'));
      query<HTMLButtonElement>('add-device')?.click();
      clickButton(query('watch-folder-device-edit'));

      expect(added).toHaveBeenCalledTimes(1);
      expect(device).toHaveBeenCalledWith('a');
      expect(edited).toHaveBeenCalledWith({ watchFolderId: 'a', deviceId: 'dev-1' });
    });
  });

  it('moves focus to the Global switch', async () => {
    await setup();

    fixture.componentInstance.focusEntry();

    expect(native().contains(document.activeElement)).toBe(true);
    expect(query('auto-launch-switch')?.contains(document.activeElement)).toBe(true);
  });
});
