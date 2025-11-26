import '@analogjs/vitest-angular/setup-zone';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { VideoSettingsSectionComponent } from './video-settings-section.component';

describe('VideoSettingsSectionComponent', () => {
  let component: VideoSettingsSectionComponent;
  let componentRef: ComponentRef<VideoSettingsSectionComponent>;
  let fixture: ComponentFixture<VideoSettingsSectionComponent>;
  let testFormGroup: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoSettingsSectionComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    // Create test FormGroup matching VideoSettings structure
    testFormGroup = new FormGroup({
      enableVideo: new FormControl(false),
    });

    fixture = TestBed.createComponent(VideoSettingsSectionComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('formGroup', testFormGroup);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept formGroup signal input', () => {
    fixture.detectChanges();
    expect(component.formGroup()).toBe(testFormGroup);
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

  it('should render scaling card with correct title', () => {
    fixture.detectChanges();

    const cardTitle = fixture.nativeElement.querySelector('mat-card-title');
    expect(cardTitle?.textContent?.trim()).toBe('Video Settings');
  });

  it('should render settings toggle item with correct label', () => {
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('mat-slide-toggle');
    expect(toggle).toBeTruthy();

    const label = fixture.nativeElement.querySelector('.toggle-label');
    expect(label?.textContent?.trim()).toBe('Enable video capture');
  });

  it('should bind enableVideo toggle to form control', () => {
    fixture.detectChanges();

    expect(testFormGroup.get('enableVideo')?.value).toBe(false);

    testFormGroup.get('enableVideo')?.setValue(true);
    fixture.detectChanges();

    expect(testFormGroup.get('enableVideo')?.value).toBe(true);
  });

  it('should reflect form control changes', () => {
    fixture.detectChanges();

    testFormGroup.get('enableVideo')?.setValue(true);
    expect(testFormGroup.get('enableVideo')?.value).toBe(true);

    testFormGroup.get('enableVideo')?.setValue(false);
    expect(testFormGroup.get('enableVideo')?.value).toBe(false);
  });
});
