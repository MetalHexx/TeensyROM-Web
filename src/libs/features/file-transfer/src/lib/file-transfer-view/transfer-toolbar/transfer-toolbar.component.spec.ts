import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
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
        { provide: DeviceStore, useValue: { devices: devicesSignal } },
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

  it('ships an empty actions slot', () => {
    const native = fixture.nativeElement as HTMLElement;
    const actionSections = native.querySelectorAll('.toolbar-actions-section');
    expect(actionSections.length).toBeGreaterThan(0);
    actionSections.forEach((section) => expect(section.textContent?.trim()).toBe(''));
  });
});
