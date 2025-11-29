import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { VideoControlsToolbarComponent } from './video-controls-toolbar.component';

describe('VideoControlsToolbarComponent', () => {
  let component: VideoControlsToolbarComponent;
  let fixture: ComponentFixture<VideoControlsToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoControlsToolbarComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoControlsToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Creation', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should render all buttons by default', () => {
      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button');
      // CRT toggle, CRT settings (when enabled), device selector, fullscreen
      expect(buttons.length).toBe(4);
    });
  });

  describe('Button Visibility', () => {
    it('should hide CRT settings when CRT is disabled', () => {
      fixture.componentRef.setInput('isCrtEnabled', false);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button');
      // CRT toggle, device selector, fullscreen (no tune button)
      expect(buttons.length).toBe(3);
    });

    it('should show close button when enabled', () => {
      fixture.componentRef.setInput('showClose', true);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button');
      expect(buttons.length).toBe(5);
    });

    it('should hide device selector when disabled', () => {
      fixture.componentRef.setInput('showDeviceSelector', false);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button');
      expect(buttons.length).toBe(3);
    });
  });

  describe('Button Click Events', () => {
    it('should emit crtToggleClick when CRT button is clicked', () => {
      const crtToggleSpy = vi.fn();
      component.crtToggleClick.subscribe(crtToggleSpy);

      const crtButton = fixture.nativeElement.querySelector('lib-icon-button');
      const innerButton = crtButton.querySelector('button');
      innerButton?.click();

      expect(crtToggleSpy).toHaveBeenCalled();
    });

    it('should emit deviceSelectorClick when videocam button is clicked', () => {
      const deviceSelectorSpy = vi.fn();
      component.deviceSelectorClick.subscribe(deviceSelectorSpy);

      // Find the videocam button (3rd button when all visible)
      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button') as NodeListOf<HTMLElement>;
      const deviceButton = Array.from(buttons).find((btn) =>
        btn.querySelector('mat-icon')?.textContent?.trim() === 'videocam'
      );
      const innerButton = deviceButton?.querySelector('button');
      innerButton?.click();

      expect(deviceSelectorSpy).toHaveBeenCalled();
    });

    it('should emit fullscreenClick when fullscreen button is clicked', () => {
      const fullscreenSpy = vi.fn();
      component.fullscreenClick.subscribe(fullscreenSpy);

      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button') as NodeListOf<HTMLElement>;
      const fullscreenButton = Array.from(buttons).find((btn) =>
        btn.querySelector('mat-icon')?.textContent?.trim() === 'fullscreen'
      );
      const innerButton = fullscreenButton?.querySelector('button');
      innerButton?.click();

      expect(fullscreenSpy).toHaveBeenCalled();
    });
  });

  describe('Icon States', () => {
    it('should show tv icon when CRT is enabled', () => {
      fixture.componentRef.setInput('isCrtEnabled', true);
      fixture.detectChanges();

      const crtButton = fixture.nativeElement.querySelector('lib-icon-button');
      const icon = crtButton.querySelector('mat-icon');
      expect(icon?.textContent?.trim()).toBe('tv');
    });

    it('should show tv_off icon when CRT is disabled', () => {
      fixture.componentRef.setInput('isCrtEnabled', false);
      fixture.detectChanges();

      const crtButton = fixture.nativeElement.querySelector('lib-icon-button');
      const icon = crtButton.querySelector('mat-icon');
      expect(icon?.textContent?.trim()).toBe('tv_off');
    });

    it('should show fullscreen_exit icon when in fullscreen', () => {
      fixture.componentRef.setInput('isFullscreen', true);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button') as NodeListOf<HTMLElement>;
      const fullscreenButton = Array.from(buttons).find((btn) =>
        btn.querySelector('mat-icon')?.textContent?.includes('fullscreen')
      );
      const icon = fullscreenButton?.querySelector('mat-icon');
      expect(icon?.textContent?.trim()).toBe('fullscreen_exit');
    });
  });

  describe('Active States', () => {
    it('should add active class to CRT button when enabled', () => {
      fixture.componentRef.setInput('isCrtEnabled', true);
      fixture.detectChanges();

      const crtButton = fixture.nativeElement.querySelector('lib-icon-button');
      expect(crtButton.classList.contains('active')).toBe(true);
    });

    it('should add active class to tune button when CRT controls are shown', () => {
      fixture.componentRef.setInput('isCrtEnabled', true);
      fixture.componentRef.setInput('showCrtControls', true);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button') as NodeListOf<HTMLElement>;
      const tuneButton = Array.from(buttons).find((btn) =>
        btn.querySelector('mat-icon')?.textContent?.trim() === 'tune'
      );
      expect(tuneButton?.classList.contains('active')).toBe(true);
    });

    it('should add active class to device selector button when active', () => {
      fixture.componentRef.setInput('isDeviceSelectorActive', true);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button') as NodeListOf<HTMLElement>;
      const deviceButton = Array.from(buttons).find((btn) =>
        btn.querySelector('mat-icon')?.textContent?.trim() === 'videocam'
      );
      expect(deviceButton?.classList.contains('active')).toBe(true);
    });

    it('should not have active class on device selector button when inactive', () => {
      fixture.componentRef.setInput('isDeviceSelectorActive', false);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('lib-icon-button') as NodeListOf<HTMLElement>;
      const deviceButton = Array.from(buttons).find((btn) =>
        btn.querySelector('mat-icon')?.textContent?.trim() === 'videocam'
      );
      expect(deviceButton?.classList.contains('active')).toBe(false);
    });
  });
});
