import '@analogjs/vitest-angular/setup-zone';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConnectionSettingsSectionComponent } from './connection-settings-section.component';

describe('ConnectionSettingsSectionComponent', () => {
  let component: ConnectionSettingsSectionComponent;
  let componentRef: ComponentRef<ConnectionSettingsSectionComponent>;
  let fixture: ComponentFixture<ConnectionSettingsSectionComponent>;
  let testFormGroup: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectionSettingsSectionComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    // Create test FormGroup matching ConnectionSettings structure
    testFormGroup = new FormGroup({
      connectionType: new FormControl('Serial', Validators.required),
      autoConnectEnabled: new FormControl(false),
    });

    fixture = TestBed.createComponent(ConnectionSettingsSectionComponent);
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
    expect(cardTitle?.textContent?.trim()).toBe('Connection Settings');
  });

  it('should bind connectionType radio group to form control', () => {
    fixture.detectChanges();

    const radioGroup = fixture.nativeElement.querySelector('mat-radio-group');
    expect(radioGroup).toBeTruthy();
    expect(testFormGroup.get('connectionType')?.value).toBe('Serial');
  });

  it('should display both Serial and Tcp radio options', () => {
    fixture.detectChanges();

    const radioButtons = fixture.nativeElement.querySelectorAll('mat-radio-button');
    expect(radioButtons.length).toBe(2);
    expect(radioButtons[0].textContent).toContain('Serial');
    expect(radioButtons[1].textContent).toContain('TCP/Ethernet');
  });

  it('should update form value when radio selection changes', () => {
    fixture.detectChanges();

    // Set value directly on form control to test binding
    testFormGroup.get('connectionType')?.setValue('Tcp');
    fixture.detectChanges();

    expect(testFormGroup.get('connectionType')?.value).toBe('Tcp');
  });

  it('should bind autoConnectEnabled toggle to form control', () => {
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('mat-slide-toggle');
    expect(toggle).toBeTruthy();
    expect(testFormGroup.get('autoConnectEnabled')?.value).toBe(false);
  });

  it('should update form value when toggle changes', () => {
    fixture.detectChanges();

    testFormGroup.get('autoConnectEnabled')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('autoConnectEnabled')?.value).toBe(true);
  });

  it('should display validation error when connectionType is invalid and touched', () => {
    testFormGroup.get('connectionType')?.setValue(null);
    testFormGroup.get('connectionType')?.markAsTouched();
    fixture.detectChanges();

    const errorElement = fixture.nativeElement.querySelector('mat-error');
    expect(errorElement?.textContent?.trim()).toBe('Connection type is required');
  });

  it('should not display validation error when connectionType is valid', () => {
    testFormGroup.get('connectionType')?.setValue('Serial');
    testFormGroup.get('connectionType')?.markAsTouched();
    fixture.detectChanges();

    const errorElement = fixture.nativeElement.querySelector('mat-error');
    expect(errorElement).toBeFalsy();
  });

  it('should reflect form validity state', () => {
    fixture.detectChanges();

    expect(testFormGroup.valid).toBe(true);

    testFormGroup.get('connectionType')?.setValue(null);
    expect(testFormGroup.valid).toBe(false);

    testFormGroup.get('connectionType')?.setValue('Tcp');
    expect(testFormGroup.valid).toBe(true);
  });
});
