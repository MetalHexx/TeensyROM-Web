import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingTextComponent } from './loading-text.component';
import { ComponentRef } from '@angular/core';

describe('LoadingTextComponent', () => {
  let component: LoadingTextComponent;
  let componentRef: ComponentRef<LoadingTextComponent>;
  let fixture: ComponentFixture<LoadingTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingTextComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingTextComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to not visible', () => {
    expect(component.visible()).toBe(false);
  });

  it('should show spinner by default', () => {
    expect(component.showSpinner()).toBe(true);
  });

  it('should apply visible class when visible input is true', () => {
    componentRef.setInput('visible', true);
    fixture.detectChanges();

    const hostElement = fixture.nativeElement as HTMLElement;
    expect(hostElement.classList.contains('visible')).toBe(true);
  });

  it('should not apply visible class when visible input is false', () => {
    componentRef.setInput('visible', false);
    fixture.detectChanges();

    const hostElement = fixture.nativeElement as HTMLElement;
    expect(hostElement.classList.contains('visible')).toBe(false);
  });

  it('should accept custom animation duration', () => {
    componentRef.setInput('animationDuration', 500);
    fixture.detectChanges();

    expect(component.animationDuration()).toBe(500);
  });

  it('should allow disabling spinner', () => {
    componentRef.setInput('showSpinner', false);
    fixture.detectChanges();

    expect(component.showSpinner()).toBe(false);
  });

  it('should display "Loading..." as default text', () => {
    fixture.detectChanges();

    const loadingTextWrapper = fixture.nativeElement.querySelector('.loading-text-wrapper');
    expect(loadingTextWrapper?.textContent?.trim()).toBe('Loading...');
  });

  it('should display custom text via text input', () => {
    componentRef.setInput('text', 'Autosaving...');
    fixture.detectChanges();

    const loadingTextWrapper = fixture.nativeElement.querySelector('.loading-text-wrapper');
    expect(loadingTextWrapper?.textContent?.trim()).toBe('Autosaving...');
  });

  it('should allow different custom text values', () => {
    componentRef.setInput('text', 'Processing...');
    fixture.detectChanges();

    const loadingTextWrapper = fixture.nativeElement.querySelector('.loading-text-wrapper');
    expect(loadingTextWrapper?.textContent?.trim()).toBe('Processing...');
  });

  it('should update text when input changes', () => {
    componentRef.setInput('text', 'Saving...');
    fixture.detectChanges();

    let loadingTextWrapper = fixture.nativeElement.querySelector('.loading-text-wrapper');
    expect(loadingTextWrapper?.textContent?.trim()).toBe('Saving...');

    componentRef.setInput('text', 'Loading...');
    fixture.detectChanges();

    loadingTextWrapper = fixture.nativeElement.querySelector('.loading-text-wrapper');
    expect(loadingTextWrapper?.textContent?.trim()).toBe('Loading...');
  });
});
