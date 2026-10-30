import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { ColorThemeStore, SettingsStore } from '@teensyrom-nx/application';
import { ColorTheme, ColorThemeKind, Device, DeviceColors } from '@teensyrom-nx/domain';
import { ThemeViewComponent } from './theme-view.component';
import { ThemeColorsCardComponent } from './theme-colors-card/theme-colors-card.component';
import { ThemePreviewComponent } from './theme-preview/theme-preview.component';
import { ThemeListComponent } from './theme-list/theme-list.component';
import { By } from '@angular/platform-browser';
import { recordInfoText, themeSubtitle, validateThemeName } from './theme-texts';

const colors: DeviceColors = {
  background: 0,
  border: 4,
  banner: 4,
  time: 10,
  option: 7,
  sources: 14,
  name: 13,
};
const makeTheme = (id: string, name: string, kind: ColorThemeKind): ColorTheme => ({
  id,
  name,
  kind,
  parts: { device: colors },
});
const shipped = makeTheme('tr-default', 'TR Default', ColorThemeKind.Shipped);
const custom = makeTheme('c1', 'Mine', ColorThemeKind.Custom);

describe('ThemeViewComponent', () => {
  let fixture: ComponentFixture<ThemeViewComponent>;
  let selectedTheme: WritableSignal<ColorTheme | null>;
  let isEdited: WritableSignal<boolean>;
  let hasInitialised: WritableSignal<boolean>;
  let recordState: WritableSignal<unknown>;
  let targetDevices: WritableSignal<Device[]>;
  let videoEnabled: Record<string, WritableSignal<boolean>>;
  let store: Record<string, unknown> & {
    loadMissingRecords: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
    selectTheme: ReturnType<typeof vi.fn>;
    setSlotColor: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    selectedTheme = signal<ColorTheme | null>(shipped);
    isEdited = signal(false);
    hasInitialised = signal(true);
    recordState = signal({ kind: 'none' });
    targetDevices = signal<Device[]>([]);
    videoEnabled = { d1: signal(false), d2: signal(false) };
    store = {
      loadMissingRecords: vi.fn(),
      connectedDevices: targetDevices,
      targetDevices,
      showApplyTarget: signal(false),
      effectiveApplyTarget: signal('all'),
      canApply: signal(false),
      unchangedThemeId: signal<string | null>(null),
      themes: signal([shipped, custom]),
      shippedThemes: signal([shipped]),
      customThemes: signal([custom]),
      selectedThemeId: signal<string | null>('tr-default'),
      selectedTheme,
      isEdited,
      draft: signal(colors),
      recordState,
      canSave: signal(false),
      canDelete: signal(false),
      initialize: vi.fn(),
      hasInitialised,
      selectTheme: vi.fn(),
      setSlotColor: vi.fn(),
      saveSelected: vi.fn(),
      saveAs: vi.fn(),
      deleteSelected: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ThemeViewComponent],
      providers: [
        { provide: ColorThemeStore, useValue: store },
        {
          provide: SettingsStore,
          useValue: {
            enableVideoForDevice: (id: string) => videoEnabled[id],
            videoDeviceIdForDevice: () => signal(''),
            updateDeviceVideoDeviceId: vi.fn(),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        provideNoopAnimations(),
      ],
    });
    fixture = TestBed.createComponent(ThemeViewComponent);
    fixture.detectChanges();
  });

  it('initializes the store on init', () => {
    expect(store.initialize).toHaveBeenCalledTimes(1);
  });

  describe('preview', () => {
    const preview = () => fixture.debugElement.query(By.directive(ThemePreviewComponent));
    const setDevices = (...ids: string[]) => {
      targetDevices.set(ids.map((id) => ({ deviceId: id, name: id }) as Device));
      fixture.detectChanges();
    };

    it('is absent without a target device that has video enabled', () => {
      setDevices('d1', 'd2');

      expect(preview()).toBeNull();
      expect(fixture.nativeElement.querySelector('.theme-view.with-preview')).toBeNull();
    });

    it('previews the first target device with video enabled', () => {
      videoEnabled['d2'].set(true);
      setDevices('d1', 'd2');

      expect(preview().componentInstance.deviceId()).toBe('d2');

      videoEnabled['d1'].set(true);
      fixture.detectChanges();

      expect(preview().componentInstance.deviceId()).toBe('d1');
    });
  });

  it('renders no native title attribute anywhere in the view', () => {
    const titled = () => Array.from(fixture.nativeElement.querySelectorAll('[title]'));

    expect(titled()).toEqual([]);

    videoEnabled['d1'].set(true);
    targetDevices.set([{ deviceId: 'd1', name: 'd1' } as Device]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('lib-theme-preview')).not.toBeNull();
    expect(titled()).toEqual([]);
  });

  it('loads missing records when the connected devices change', () => {
    const calls = store.loadMissingRecords.mock.calls.length;

    targetDevices.set([{ deviceId: 'd1', name: 'd1' } as Device]);
    fixture.detectChanges();

    expect(store.loadMissingRecords.mock.calls.length).toBeGreaterThan(calls);
  });

  it('loads missing records again once the store has initialized', () => {
    const calls = store.loadMissingRecords.mock.calls.length;

    hasInitialised.set(false);
    fixture.detectChanges();
    hasInitialised.set(true);
    fixture.detectChanges();

    expect(store.loadMissingRecords.mock.calls.length).toBeGreaterThan(calls);
  });

  it('selects a theme through the store when the list emits', () => {
    fixture.debugElement
      .query(By.directive(ThemeListComponent))
      .componentInstance.themeSelected.emit('c1');

    expect(store.selectTheme).toHaveBeenCalledWith('c1');
  });

  it('sets a slot color through the store when a picker changes', () => {
    fixture.debugElement
      .query(By.directive(ThemeColorsCardComponent))
      .componentInstance.colorChange.emit({ slot: 'border', colorIndex: 2 });

    expect(store.setSlotColor).toHaveBeenCalledWith('border', 2);
  });

  it('passes the subtitle and info text for the current state to the colors card', () => {
    const card = () =>
      fixture.debugElement.query(By.directive(ThemeColorsCardComponent))
        .componentInstance as ThemeColorsCardComponent;

    expect(card().subtitle()).toBe('TR Default · Shipped, read-only');
    expect(card().infoText()).toContain('No colors on record yet');

    selectedTheme.set(custom);
    recordState.set({ kind: 'recorded' });
    fixture.detectChanges();

    expect(card().subtitle()).toBe('Mine · Custom');
    expect(card().infoText()).toContain('last applied from TeensyROM Web');
  });
});

describe('theme texts', () => {
  describe('themeSubtitle', () => {
    it.each([
      [custom, false, 'Mine · Custom'],
      [shipped, false, 'TR Default · Shipped, read-only'],
      [custom, true, 'Mine · Edited'],
      [null, false, 'Unsaved colors'],
    ])('reads %#', (theme, edited, expected) => {
      expect(themeSubtitle(theme, edited)).toBe(expected);
    });
  });

  describe('recordInfoText', () => {
    it('names both devices when two differ', () => {
      expect(
        recordInfoText({ kind: 'differ', shownDeviceName: 'A', deviceNames: ['A', 'B'] })
      ).toBe("A and B have different colors on record. Showing A's colors.");
    });

    it('is generic when three or more differ', () => {
      expect(
        recordInfoText({ kind: 'differ', shownDeviceName: 'A', deviceNames: ['A', 'B', 'C'] })
      ).toBe("The connected devices have different colors on record. Showing A's colors.");
    });
  });

  describe('validateThemeName', () => {
    it('refuses a taken name regardless of case', () => {
      expect(validateThemeName('tr default', ['TR Default'])).toBe(
        'A theme with that name already exists.'
      );
    });

    it('refuses blank, too long and control-character names', () => {
      const message = 'Name must be 1–24 characters with no control characters.';
      expect(validateThemeName('   ', [])).toBe(message);
      expect(validateThemeName('x'.repeat(25), [])).toBe(message);
      expect(validateThemeName('a\u0007b', [])).toBe(message);
    });

    it('accepts a fresh name', () => {
      expect(validateThemeName('Fresh', ['TR Default'])).toBe('');
    });
  });
});
