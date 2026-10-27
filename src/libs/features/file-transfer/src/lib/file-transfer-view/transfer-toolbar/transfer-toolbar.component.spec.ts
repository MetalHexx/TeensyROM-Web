import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { DeviceStore, TransferStore } from '@teensyrom-nx/application';
import { Device } from '@teensyrom-nx/domain';
import { ProgressBarComponent } from '@teensyrom-nx/ui/components';
import { TransferToolbarComponent } from './transfer-toolbar.component';
import { DeviceSelectorComponent } from './device-selector/device-selector.component';

describe('TransferToolbarComponent', () => {
  let fixture: ComponentFixture<TransferToolbarComponent>;

  beforeEach(async () => {
    const devicesSignal = signal<Device[]>([]);

    await TestBed.configureTestingModule({
      imports: [TransferToolbarComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        { provide: DeviceStore, useValue: { devices: devicesSignal, usableDevices: devicesSignal } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferToolbarComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the device selector', () => {
    expect(fixture.debugElement.query(By.directive(DeviceSelectorComponent))).toBeTruthy();
  });

  it('renders a progress bar bound to show=false', () => {
    const progressBar = fixture.debugElement.query(By.directive(ProgressBarComponent));
    expect(progressBar).toBeTruthy();
    expect(progressBar.componentInstance.show()).toBe(false);
  });

  it('renders both the desktop and tablet control rows', () => {
    const native = fixture.nativeElement as HTMLElement;
    const rows = native.querySelectorAll('[data-testid="transfer-toolbar"]');
    expect(rows.length).toBe(2);
  });

  describe('settings gear', () => {
    const gears = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
          '[data-testid="transfer-settings-button"]'
        )
      );

    it('renders a gear in both the desktop and tablet layouts', () => {
      expect(gears().length).toBe(2);
    });

    it('emits settingsToggle when a gear is pressed', () => {
      const toggled = vi.fn();
      fixture.componentInstance.settingsToggle.subscribe(toggled);

      gears()[0].querySelector('button')?.click();
      gears()[1].querySelector('button')?.click();

      expect(toggled).toHaveBeenCalledTimes(2);
    });

    it('reports the open state through the label, highlight and aria-expanded', () => {
      fixture.componentRef.setInput('settingsOpen', true);
      fixture.detectChanges();

      gears().forEach((gear) => {
        const button = gear.querySelector('button') as HTMLButtonElement;
        expect(button.getAttribute('aria-label')).toBe('Close transfer settings');
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(gear.querySelector('mat-icon')?.classList.contains('highlight')).toBe(true);
      });
    });

    it('labels the gear as opening the panel while it is closed', () => {
      gears().forEach((gear) => {
        const button = gear.querySelector('button') as HTMLButtonElement;
        expect(button.getAttribute('aria-label')).toBe('Open transfer settings');
        expect(button.getAttribute('aria-expanded')).toBe('false');
      });
    });

    it('focuses the gear that is showing', () => {
      const [desktop, tablet] = gears().map((g) => g.querySelector('button') as HTMLButtonElement);
      vi.spyOn(desktop, 'getClientRects').mockReturnValue([] as unknown as DOMRectList);
      vi.spyOn(tablet, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
      const focusTablet = vi.spyOn(tablet, 'focus');
      const focusDesktop = vi.spyOn(desktop, 'focus');

      fixture.componentInstance.focusSettingsButton();

      expect(focusTablet).toHaveBeenCalled();
      expect(focusDesktop).not.toHaveBeenCalled();
    });
  });
});
