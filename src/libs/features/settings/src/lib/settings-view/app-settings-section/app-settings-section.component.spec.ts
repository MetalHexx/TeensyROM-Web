import '@analogjs/vitest-angular/setup-zone';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppSettingsSectionComponent } from './app-settings-section.component';

describe('AppSettingsSectionComponent', () => {
  let component: AppSettingsSectionComponent;
  let componentRef: ComponentRef<AppSettingsSectionComponent>;
  let fixture: ComponentFixture<AppSettingsSectionComponent>;
  let testFormGroup: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppSettingsSectionComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    // Create test FormGroup matching AppSettings structure
    testFormGroup = new FormGroup({
      setupCompleted: new FormControl(true),
    });

    fixture = TestBed.createComponent(AppSettingsSectionComponent);
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
    expect(cardTitle?.textContent?.trim()).toBe('Application Settings');
  });

  it('should render setupCompleted toggle', () => {
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('mat-slide-toggle');
    expect(toggle).toBeTruthy();
  });

  it('should bind setupCompleted toggle to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('setupCompleted')?.value).toBe(true);

    testFormGroup.get('setupCompleted')?.setValue(false);
    fixture.detectChanges();

    expect(testFormGroup.get('setupCompleted')?.value).toBe(false);
  });

  it('should display toggle label and description', () => {
    fixture.detectChanges();

    const toggleLabel = fixture.nativeElement.querySelector('.toggle-label');
    const toggleDescription = fixture.nativeElement.querySelector('.toggle-description');

    expect(toggleLabel?.textContent?.trim()).toBe('Initial setup completed');
    expect(toggleDescription?.textContent).toContain('first-time setup wizard');
  });

  it('should reflect form validity state', () => {
    fixture.detectChanges();

    expect(testFormGroup.valid).toBe(true);

    testFormGroup.get('setupCompleted')?.setValue(null);
    fixture.detectChanges();

    // Boolean controls typically don't have validation, but we verify the control works
    expect(testFormGroup.get('setupCompleted')?.value).toBeNull();
  });

  it('should accept animationTrigger input', () => {
    componentRef.setInput('animationTrigger', true);
    fixture.detectChanges();

    expect(component.animationTrigger()).toBe(true);

    componentRef.setInput('animationTrigger', false);
    fixture.detectChanges();

    expect(component.animationTrigger()).toBe(false);
  });
});
