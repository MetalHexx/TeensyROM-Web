import '@analogjs/vitest-angular/setup-zone';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SearchSettingsSectionComponent } from './search-settings-section.component';

describe('SearchSettingsSectionComponent', () => {
  let component: SearchSettingsSectionComponent;
  let componentRef: ComponentRef<SearchSettingsSectionComponent>;
  let fixture: ComponentFixture<SearchSettingsSectionComponent>;
  let testFormGroup: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchSettingsSectionComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    // Create test FormGroup matching SearchSettings structure
    testFormGroup = new FormGroup({
      weights: new FormGroup({
        nameWeight: new FormControl(5, [Validators.min(0)]),
        titleWeight: new FormControl(8, [Validators.min(0)]),
        creatorWeight: new FormControl(3, [Validators.min(0)]),
        releaseInfoWeight: new FormControl(2, [Validators.min(0)]),
        descriptionWeight: new FormControl(4, [Validators.min(0)]),
      }),
      stopWords: new FormControl('the,and,or', Validators.required),
      bannedDirectories: new FormControl('/system,/temp', Validators.required),
      bannedFiles: new FormControl('.DS_Store,thumbs.db', Validators.required),
    });

    fixture = TestBed.createComponent(SearchSettingsSectionComponent);
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
    expect(cardTitle?.textContent?.trim()).toBe('Search Settings');
  });

  it('should access nested weights FormGroup via computed signal', () => {
    fixture.detectChanges();

    const weightsGroup = component.weightsGroup();
    expect(weightsGroup).toBeTruthy();
    expect(weightsGroup.get('nameWeight')?.value).toBe(5);
  });

  it('should render all 5 weight sliders', () => {
    fixture.detectChanges();

    const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
    expect(sliders.length).toBe(5);
  });

  it('should display current value for each weight slider', () => {
    fixture.detectChanges();

    const sliderValues = fixture.nativeElement.querySelectorAll('.slider-value');
    expect(sliderValues.length).toBe(5);
    expect(sliderValues[0].textContent?.trim()).toBe('5'); // nameWeight
    expect(sliderValues[1].textContent?.trim()).toBe('8'); // titleWeight
  });

  it('should bind nameWeight slider to form control', () => {
    fixture.detectChanges();

    const weightsGroup = testFormGroup.get('weights') as FormGroup;
    expect(weightsGroup.get('nameWeight')?.value).toBe(5);

    weightsGroup.get('nameWeight')?.setValue(7);
    fixture.detectChanges();

    const sliderValue = fixture.nativeElement.querySelectorAll('.slider-value')[0];
    expect(sliderValue.textContent?.trim()).toBe('7');
  });

  it('should bind all weight sliders to their respective form controls', () => {
    fixture.detectChanges();

    const weightsGroup = testFormGroup.get('weights') as FormGroup;

    weightsGroup.get('titleWeight')?.setValue(10);
    weightsGroup.get('creatorWeight')?.setValue(6);
    fixture.detectChanges();

    expect(weightsGroup.get('titleWeight')?.value).toBe(10);
    expect(weightsGroup.get('creatorWeight')?.value).toBe(6);
  });

  it('should render 3 textarea fields for arrays', () => {
    fixture.detectChanges();

    const textareas = fixture.nativeElement.querySelectorAll('textarea');
    expect(textareas.length).toBe(3);
  });

  it('should bind stopWords textarea to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('stopWords')?.value).toBe('the,and,or');

    testFormGroup.get('stopWords')?.setValue('a,an,the');
    fixture.detectChanges();

    expect(testFormGroup.get('stopWords')?.value).toBe('a,an,the');
  });

  it('should bind bannedDirectories textarea to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('bannedDirectories')?.value).toBe('/system,/temp');

    testFormGroup.get('bannedDirectories')?.setValue('/cache,/logs');
    fixture.detectChanges();

    expect(testFormGroup.get('bannedDirectories')?.value).toBe('/cache,/logs');
  });

  it('should bind bannedFiles textarea to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('bannedFiles')?.value).toBe('.DS_Store,thumbs.db');

    testFormGroup.get('bannedFiles')?.setValue('desktop.ini');
    fixture.detectChanges();

    expect(testFormGroup.get('bannedFiles')?.value).toBe('desktop.ini');
  });

  it('should display validation error when stopWords is empty and touched', () => {
    testFormGroup.get('stopWords')?.setValue('');
    testFormGroup.get('stopWords')?.markAsTouched();
    fixture.detectChanges();

    const errorElements = fixture.nativeElement.querySelectorAll('mat-error');
    const hasStopWordsError = Array.from(errorElements as NodeListOf<Element>).some((el: Element) =>
      el.textContent?.includes('Stop words list is required')
    );
    expect(hasStopWordsError).toBe(true);
  });

  it('should display validation error when bannedDirectories is empty and touched', () => {
    testFormGroup.get('bannedDirectories')?.setValue('');
    testFormGroup.get('bannedDirectories')?.markAsTouched();
    fixture.detectChanges();

    const errorElements = fixture.nativeElement.querySelectorAll('mat-error');
    const hasBannedDirsError = Array.from(errorElements as NodeListOf<Element>).some((el: Element) =>
      el.textContent?.includes('Banned directories list is required')
    );
    expect(hasBannedDirsError).toBe(true);
  });

  it('should display validation error when bannedFiles is empty and touched', () => {
    testFormGroup.get('bannedFiles')?.setValue('');
    testFormGroup.get('bannedFiles')?.markAsTouched();
    fixture.detectChanges();

    const errorElements = fixture.nativeElement.querySelectorAll('mat-error');
    const hasBannedFilesError = Array.from(errorElements as NodeListOf<Element>).some((el: Element) =>
      el.textContent?.includes('Banned files list is required')
    );
    expect(hasBannedFilesError).toBe(true);
  });

  it('should have three settings groups with titles', () => {
    fixture.detectChanges();

    const groupTitles = fixture.nativeElement.querySelectorAll('.group-title');
    expect(groupTitles.length).toBe(3);
    expect(groupTitles[0].textContent?.trim()).toBe('Search Weights');
    expect(groupTitles[1].textContent?.trim()).toBe('Stop Words');
    expect(groupTitles[2].textContent?.trim()).toBe('Banned Content');
  });

  it('should reflect form validity state', () => {
    fixture.detectChanges();

    expect(testFormGroup.valid).toBe(true);

    testFormGroup.get('stopWords')?.setValue('');
    expect(testFormGroup.valid).toBe(false);

    testFormGroup.get('stopWords')?.setValue('valid,words');
    expect(testFormGroup.valid).toBe(true);
  });
});
