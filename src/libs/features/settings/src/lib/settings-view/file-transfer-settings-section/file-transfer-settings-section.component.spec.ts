import '@analogjs/vitest-angular/setup-zone';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FileTransferSettingsSectionComponent } from './file-transfer-settings-section.component';

describe('FileTransferSettingsSectionComponent', () => {
  let component: FileTransferSettingsSectionComponent;
  let componentRef: ComponentRef<FileTransferSettingsSectionComponent>;
  let fixture: ComponentFixture<FileTransferSettingsSectionComponent>;
  let testFormGroup: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileTransferSettingsSectionComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    // Create test FormGroup matching FileTransferSettings structure
    testFormGroup = new FormGroup({
      autoLaunchOnCopyEnabled: new FormControl(false),
    });

    fixture = TestBed.createComponent(FileTransferSettingsSectionComponent);
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
    expect(cardTitle?.textContent?.trim()).toBe('File Transfer Settings');
  });

  it('should render no text inputs', () => {
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('input[matInput]');
    expect(inputs.length).toBe(0);
  });

  it('should render the auto-launch toggle control', () => {
    fixture.detectChanges();

    const toggles = fixture.nativeElement.querySelectorAll('mat-slide-toggle');
    expect(toggles.length).toBe(1);
  });

  it('should bind autoLaunchOnCopyEnabled toggle to form control', () => {
    fixture.detectChanges();

    testFormGroup.get('autoLaunchOnCopyEnabled')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('autoLaunchOnCopyEnabled')?.value).toBe(true);
  });

  it('should have a Launching settings group', () => {
    fixture.detectChanges();

    const groupTitles = fixture.nativeElement.querySelectorAll('.group-title');
    expect(groupTitles.length).toBe(1);
    expect(groupTitles[0].textContent?.trim()).toBe('Launching');
  });

  it('should accept animationTrigger input', () => {
    componentRef.setInput('animationTrigger', true);
    fixture.detectChanges();

    expect(component.animationTrigger()).toBe(true);

    componentRef.setInput('animationTrigger', false);
    fixture.detectChanges();

    expect(component.animationTrigger()).toBe(false);
  });

  it('should default animationTrigger to true', () => {
    fixture.detectChanges();
    expect(component.animationTrigger()).toBe(true);
  });
});
