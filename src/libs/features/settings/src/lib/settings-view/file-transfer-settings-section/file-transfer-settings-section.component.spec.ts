import '@analogjs/vitest-angular/setup-zone';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
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
      watchDirectoryLocation: new FormControl(''),
      autoTransferPath: new FormControl('/teensyrom/files', Validators.required),
      autoFileCopyEnabled: new FormControl(false),
      autoLaunchOnCopyEnabled: new FormControl(false),
      navToDirOnLaunch: new FormControl(true),
      syncFilesEnabled: new FormControl(false),
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

  it('should render two text input fields', () => {
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('input[matInput]');
    expect(inputs.length).toBe(2);
  });

  it('should bind watchDirectoryLocation to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('watchDirectoryLocation')?.value).toBe('');

    testFormGroup.get('watchDirectoryLocation')?.setValue('C:\\watch\\folder');
    fixture.detectChanges();

    expect(testFormGroup.get('watchDirectoryLocation')?.value).toBe('C:\\watch\\folder');
  });

  it('should bind autoTransferPath to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('autoTransferPath')?.value).toBe('/teensyrom/files');

    testFormGroup.get('autoTransferPath')?.setValue('/custom/path');
    fixture.detectChanges();

    expect(testFormGroup.get('autoTransferPath')?.value).toBe('/custom/path');
  });

  it('should render all 4 toggle controls', () => {
    fixture.detectChanges();

    const toggles = fixture.nativeElement.querySelectorAll('mat-slide-toggle');
    expect(toggles.length).toBe(4);
  });

  it('should bind autoFileCopyEnabled toggle to form control', () => {
    fixture.detectChanges();

    testFormGroup.get('autoFileCopyEnabled')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('autoFileCopyEnabled')?.value).toBe(true);
  });

  it('should bind autoLaunchOnCopyEnabled toggle to form control', () => {
    fixture.detectChanges();

    testFormGroup.get('autoLaunchOnCopyEnabled')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('autoLaunchOnCopyEnabled')?.value).toBe(true);
  });

  it('should bind navToDirOnLaunch toggle to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('navToDirOnLaunch')?.value).toBe(true);

    testFormGroup.get('navToDirOnLaunch')?.setValue(false);
    fixture.detectChanges();

    expect(testFormGroup.get('navToDirOnLaunch')?.value).toBe(false);
  });

  it('should bind syncFilesEnabled toggle to form control', () => {
    fixture.detectChanges();

    testFormGroup.get('syncFilesEnabled')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('syncFilesEnabled')?.value).toBe(true);
  });

  it('should display validation error when autoTransferPath is empty and touched', () => {
    testFormGroup.get('autoTransferPath')?.setValue('');
    testFormGroup.get('autoTransferPath')?.markAsTouched();
    fixture.detectChanges();

    const errorElements = fixture.nativeElement.querySelectorAll('mat-error');
    const hasAutoTransferError = Array.from(errorElements as NodeListOf<Element>).some((el: Element) =>
      el.textContent?.includes('Auto transfer path is required')
    );
    expect(hasAutoTransferError).toBe(true);
  });

  it('should have three settings groups with titles', () => {
    fixture.detectChanges();

    const groupTitles = fixture.nativeElement.querySelectorAll('.group-title');
    expect(groupTitles.length).toBe(3);
    expect(groupTitles[0].textContent?.trim()).toBe('Directory Paths');
    expect(groupTitles[1].textContent?.trim()).toBe('Auto-Copy Behavior');
    expect(groupTitles[2].textContent?.trim()).toBe('Synchronization');
  });

  it('should reflect form validity state', () => {
    fixture.detectChanges();

    expect(testFormGroup.valid).toBe(true);

    testFormGroup.get('autoTransferPath')?.setValue('');
    expect(testFormGroup.valid).toBe(false);

    testFormGroup.get('autoTransferPath')?.setValue('/valid/path');
    expect(testFormGroup.valid).toBe(true);
  });
});
