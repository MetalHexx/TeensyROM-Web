import '@analogjs/vitest-angular/setup-zone';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PlayerSettingsSectionComponent } from './player-settings-section.component';

describe('PlayerSettingsSectionComponent', () => {
  let component: PlayerSettingsSectionComponent;
  let componentRef: ComponentRef<PlayerSettingsSectionComponent>;
  let fixture: ComponentFixture<PlayerSettingsSectionComponent>;
  let testFormGroup: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerSettingsSectionComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    // Create test FormGroup matching PlayerSettings structure
    testFormGroup = new FormGroup({
      repeatModeOnStartup: new FormControl(false),
      playTimerEnabled: new FormControl(true),
      muteFastForward: new FormControl(false),
      muteRandomSeek: new FormControl(false),
      startupFilter: new FormControl('All', Validators.required),
      startupLaunchEnabled: new FormControl(false),
      startupLaunchRandom: new FormControl(false),
    });

    fixture = TestBed.createComponent(PlayerSettingsSectionComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('formGroup', testFormGroup);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render scaling card with correct title', () => {
    fixture.detectChanges();

    const cardTitle = fixture.nativeElement.querySelector('mat-card-title');
    expect(cardTitle?.textContent?.trim()).toBe('Player Settings');
  });

  it('should render startup filter dropdown with all options', () => {
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('mat-select');
    expect(select).toBeTruthy();
    expect(component.startupFilterOptions.length).toBe(5);
  });

  it('should bind startupFilter to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('startupFilter')?.value).toBe('All');

    testFormGroup.get('startupFilter')?.setValue('Music');
    fixture.detectChanges();

    expect(testFormGroup.get('startupFilter')?.value).toBe('Music');
  });

  it('should render all 6 toggle controls', () => {
    fixture.detectChanges();

    const toggles = fixture.nativeElement.querySelectorAll('mat-slide-toggle');
    expect(toggles.length).toBe(6);
  });

  it('should bind repeatModeOnStartup toggle to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('repeatModeOnStartup')?.value).toBe(false);

    testFormGroup.get('repeatModeOnStartup')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('repeatModeOnStartup')?.value).toBe(true);
  });

  it('should bind playTimerEnabled toggle to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('playTimerEnabled')?.value).toBe(true);

    testFormGroup.get('playTimerEnabled')?.setValue(false);
    fixture.detectChanges();

    expect(testFormGroup.get('playTimerEnabled')?.value).toBe(false);
  });

  it('should bind muteFastForward toggle to form control', () => {
    fixture.detectChanges();

    testFormGroup.get('muteFastForward')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('muteFastForward')?.value).toBe(true);
  });

  it('should bind muteRandomSeek toggle to form control', () => {
    fixture.detectChanges();

    testFormGroup.get('muteRandomSeek')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('muteRandomSeek')?.value).toBe(true);
  });

  it('should bind startupLaunchEnabled toggle to form control', () => {
    fixture.detectChanges();

    testFormGroup.get('startupLaunchEnabled')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('startupLaunchEnabled')?.value).toBe(true);
  });

  it('should bind startupLaunchRandom toggle to form control', () => {
    fixture.detectChanges();

    testFormGroup.get('startupLaunchRandom')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('startupLaunchRandom')?.value).toBe(true);
  });

  it('should display validation error when startupFilter is invalid and touched', () => {
    testFormGroup.get('startupFilter')?.setValue(null);
    testFormGroup.get('startupFilter')?.markAsTouched();
    fixture.detectChanges();

    const errorElement = fixture.nativeElement.querySelector('mat-error');
    expect(errorElement?.textContent?.trim()).toBe('Startup filter is required');
  });

  it('should not display validation error when startupFilter is valid', () => {
    testFormGroup.get('startupFilter')?.setValue('Games');
    testFormGroup.get('startupFilter')?.markAsTouched();
    fixture.detectChanges();

    const errorElement = fixture.nativeElement.querySelector('mat-error');
    expect(errorElement).toBeFalsy();
  });

  it('should have two settings groups with titles', () => {
    fixture.detectChanges();

    const groupTitles = fixture.nativeElement.querySelectorAll('.group-title');
    expect(groupTitles.length).toBe(2);
    expect(groupTitles[0].textContent?.trim()).toBe('Playback Behavior');
    expect(groupTitles[1].textContent?.trim()).toBe('Startup Launch');
  });

  it('should reflect form validity state', () => {
    fixture.detectChanges();

    expect(testFormGroup.valid).toBe(true);

    testFormGroup.get('startupFilter')?.setValue(null);
    expect(testFormGroup.valid).toBe(false);

    testFormGroup.get('startupFilter')?.setValue('Hex');
    expect(testFormGroup.valid).toBe(true);
  });
});
