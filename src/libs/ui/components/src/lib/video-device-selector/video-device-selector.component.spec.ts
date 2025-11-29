import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { VideoDeviceSelectorComponent, VideoDevice } from './video-device-selector.component';

describe('VideoDeviceSelectorComponent', () => {
  let component: VideoDeviceSelectorComponent;
  let fixture: ComponentFixture<VideoDeviceSelectorComponent>;

  const mockDevices: VideoDevice[] = [
    { deviceId: 'device-1', label: 'Webcam 1' },
    { deviceId: 'device-2', label: 'Webcam 2' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoDeviceSelectorComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoDeviceSelectorComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create successfully', () => {
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should render device options', () => {
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.detectChanges();

      // Open the select to render options
      const select = fixture.nativeElement.querySelector('mat-select');
      expect(select).toBeTruthy();
    });
  });

  describe('Device Selection', () => {
    it('should emit deviceSelected when a device is chosen', () => {
      const deviceSelectedSpy = vi.fn();
      component.deviceSelected.subscribe(deviceSelectedSpy);
      
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.detectChanges();

      // Call the handler directly
      (component as unknown as { onDeviceSelected: (id: string) => void }).onDeviceSelected('device-2');

      expect(deviceSelectedSpy).toHaveBeenCalledWith('device-2');
    });
  });

  describe('Focus Management', () => {
    it('should emit openedChange when dropdown opens', () => {
      const openedChangeSpy = vi.fn();
      component.openedChange.subscribe(openedChangeSpy);
      
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.detectChanges();

      // Call the handler directly
      (component as unknown as { onOpenedChange: (isOpen: boolean) => void }).onOpenedChange(true);

      expect(openedChangeSpy).toHaveBeenCalledWith(true);
    });

    it('should emit openedChange when dropdown closes', () => {
      const openedChangeSpy = vi.fn();
      component.openedChange.subscribe(openedChangeSpy);
      
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.detectChanges();

      // Call the handler directly
      (component as unknown as { onOpenedChange: (isOpen: boolean) => void }).onOpenedChange(false);

      expect(openedChangeSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('Visibility Animation', () => {
    it('should be visible by default', () => {
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.detectChanges();

      expect(fixture.nativeElement.classList.contains('panel-hidden')).toBe(false);
    });

    it('should add panel-hidden class when visible is false', () => {
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();

      expect(fixture.nativeElement.classList.contains('panel-hidden')).toBe(true);
    });

    it('should remove panel-hidden class when visible becomes true', () => {
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();

      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();

      expect(fixture.nativeElement.classList.contains('panel-hidden')).toBe(false);
    });
  });

  describe('Slide Direction', () => {
    it('should default to slide-right direction', () => {
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.detectChanges();

      expect(fixture.nativeElement.classList.contains('slide-right')).toBe(true);
      expect(fixture.nativeElement.classList.contains('slide-left')).toBe(false);
    });

    it('should apply slide-left class when slideDirection is left', () => {
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.componentRef.setInput('slideDirection', 'left');
      fixture.detectChanges();

      expect(fixture.nativeElement.classList.contains('slide-left')).toBe(true);
      expect(fixture.nativeElement.classList.contains('slide-right')).toBe(false);
    });

    it('should apply slide-right class when slideDirection is right', () => {
      fixture.componentRef.setInput('devices', mockDevices);
      fixture.componentRef.setInput('selectedDeviceId', 'device-1');
      fixture.componentRef.setInput('slideDirection', 'right');
      fixture.detectChanges();

      expect(fixture.nativeElement.classList.contains('slide-right')).toBe(true);
      expect(fixture.nativeElement.classList.contains('slide-left')).toBe(false);
    });
  });
});
