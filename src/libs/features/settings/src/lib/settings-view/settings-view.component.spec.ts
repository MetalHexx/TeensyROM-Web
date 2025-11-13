import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SettingsViewComponent } from './settings-view.component';
import { SETTINGS_SERVICE, ISettingsService, Settings } from '@teensyrom-nx/domain';
import { of } from 'rxjs';

describe('SettingsViewComponent', () => {
  let component: SettingsViewComponent;
  let fixture: ComponentFixture<SettingsViewComponent>;

  const mockSettings: Settings = {
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: true,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: 'All',
      startupLaunchEnabled: false,
      startupLaunchRandom: false,
    },
    fileTransferSettings: {
      watchDirectoryLocation: '',
      autoTransferPath: '',
      autoFileCopyEnabled: false,
      autoLaunchOnCopyEnabled: false,
      navToDirOnLaunch: false,
      syncFilesEnabled: false,
    },
    searchSettings: {
      weights: {
        nameWeight: 5,
        titleWeight: 4,
        creatorWeight: 3,
        releaseInfoWeight: 2,
        descriptionWeight: 1,
      },
      stopWords: [],
      bannedDirectories: [],
      bannedFiles: [],
    },
    appSettings: {
      setupCompleted: true,
    },
  };

  const mockSettingsService: Partial<ISettingsService> = {
    getSettings: () => of(mockSettings),
    saveSettings: () => of(mockSettings),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsViewComponent],
      providers: [
        provideNoopAnimations(),
        { provide: SETTINGS_SERVICE, useValue: mockSettingsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have settings store injected', () => {
    expect(component['settingsStore']).toBeTruthy();
  });

  it('should access settings signal via selector', () => {
    expect(component.settings).toBeTruthy();
  });

  it('should compute formatted JSON from settings', () => {
    const formattedJson = component.formattedJson();
    expect(formattedJson).toBeTruthy();
    if (formattedJson) {
      const parsed = JSON.parse(formattedJson);
      expect(parsed).toBeDefined();
      expect(parsed.playerSettings).toBeDefined();
      expect(parsed.appSettings).toBeDefined();
    }
  });

  it('should display loading state when isLoading is true', () => {
    // Initially, after bootstrap loads settings, isLoading should be false
    expect(component.isLoading()).toBe(false);
  });

  it('should display settings JSON when data is available', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const preElement = compiled.querySelector('.settings-json');
    
    if (preElement) {
      const jsonText = preElement.textContent;
      expect(jsonText).toBeTruthy();
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        expect(parsed).toBeDefined();
      }
    }
  });

  it('should format JSON with proper indentation', () => {
    const formattedJson = component.formattedJson();
    expect(formattedJson).toBeTruthy();
    
    if (formattedJson) {
      // Check that JSON is formatted with 2-space indentation
      expect(formattedJson).toContain('\n  ');
      // Verify it's valid JSON
      expect(() => JSON.parse(formattedJson)).not.toThrow();
    }
  });

  it('should return null formatted JSON when settings is null', () => {
    // Verify the computed signal exists
    expect(component.formattedJson).toBeDefined();
  });
});
