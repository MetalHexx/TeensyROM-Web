import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DeviceSettingsSectionComponent } from './device-settings-section.component';

describe('DeviceSettingsSectionComponent', () => {
  let component: DeviceSettingsSectionComponent;
  let fixture: ComponentFixture<DeviceSettingsSectionComponent>;
  let fb: FormBuilder;

  const createDeviceFormGroup = (deviceId: string, enableVideo = false, autoConnect = true): FormGroup => {
    return fb.group({
      deviceId: [deviceId],
      videoSettings: fb.group({
        enableVideo: [enableVideo],
        videoDeviceId: [''],
      }),
      connectionSettings: fb.group({
        autoConnectEnabled: [autoConnect],
      }),
    });
  };

  beforeEach(async () => {
    fb = new FormBuilder();

    await TestBed.configureTestingModule({
      imports: [DeviceSettingsSectionComponent, ReactiveFormsModule],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceSettingsSectionComponent);
    component = fixture.componentInstance;
  });

  describe('Empty State', () => {
    it('should render empty state when no devices', () => {
      const emptyArray = fb.array([]);
      fixture.componentRef.setInput('knownDevicesArray', emptyArray);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No devices have been connected');
    });

    it('should show hint text in empty state', () => {
      const emptyArray = fb.array([]);
      fixture.componentRef.setInput('knownDevicesArray', emptyArray);
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('.hint');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain('Connect a TeensyROM device');
    });
  });

  describe('Device Cards', () => {
    it('should render device sections when devices exist', () => {
      const devicesArray = fb.array([
        createDeviceFormGroup('device-123'),
        createDeviceFormGroup('device-456'),
      ]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const deviceSections = fixture.nativeElement.querySelectorAll('.device-section');
      expect(deviceSections.length).toBe(2);
    });

    it('should not render empty state when devices exist', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeNull();
    });

    it('should display video toggle for each device', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const toggles = fixture.nativeElement.querySelectorAll('lib-settings-toggle-item');
      const videoToggle = Array.from(toggles as Element[]).find((t: Element) =>
        t.getAttribute('label')?.includes('Video')
      );
      expect(videoToggle).toBeTruthy();
    });

    // Auto-connect toggle is currently commented out in the template
    it.skip('should display auto-connect toggle for each device', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const toggles = fixture.nativeElement.querySelectorAll('lib-settings-toggle-item');
      const autoConnectToggle = Array.from(toggles as Element[]).find((t: Element) =>
        t.getAttribute('label')?.includes('Auto-connect')
      );
      expect(autoConnectToggle).toBeTruthy();
    });
  });

  describe('Device Title', () => {
    it('should display short device ID as-is', () => {
      const devicesArray = fb.array([createDeviceFormGroup('short-id')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const title = component.getDeviceTitle(devicesArray.at(0));
      expect(title).toBe('Device: short-id');
    });

    it('should truncate long device IDs', () => {
      const longId = 'very-long-device-identifier-123456789';
      const devicesArray = fb.array([createDeviceFormGroup(longId)]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const title = component.getDeviceTitle(devicesArray.at(0));
      expect(title).toBe('Device: very-long-de...');
      expect(title.length).toBeLessThan(longId.length + 8); // "Device: " prefix adds 8 chars
    });

    it('should return "Unknown" for missing device ID', () => {
      const deviceGroup = fb.group({
        videoSettings: fb.group({ enableVideo: [false] }),
        connectionSettings: fb.group({ autoConnectEnabled: [true] }),
      });
      const devicesArray = fb.array([deviceGroup]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const title = component.getDeviceTitle(devicesArray.at(0));
      expect(title).toBe('Device: Unknown');
    });
  });

  describe('Form Control Helpers', () => {
    it('should get enable video control', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123', true)]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const control = component.getEnableVideoControl(devicesArray.at(0));
      expect(control).toBeTruthy();
      expect(control?.value).toBe(true);
    });

    it('should get auto connect control', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123', false, false)]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const control = component.getAutoConnectControl(devicesArray.at(0));
      expect(control).toBeTruthy();
      expect(control?.value).toBe(false);
    });
  });

  describe('Animation Trigger', () => {
    it('should default animationTrigger to true', () => {
      const devicesArray = fb.array([]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      expect(component.animationTrigger()).toBe(true);
    });

    it('should accept custom animationTrigger', () => {
      const devicesArray = fb.array([]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.componentRef.setInput('animationTrigger', false);
      fixture.detectChanges();

      expect(component.animationTrigger()).toBe(false);
    });
  });
});
