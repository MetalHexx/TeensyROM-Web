import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PlayerViewComponent } from './player-view.component';
import {
  DEVICE_SERVICE,
  DEVICE_STORAGE_SERVICE,
  DEVICE_LOGS_SERVICE,
  STORAGE_SERVICE,
  IDeviceService,
  IStorageService,
  IDeviceLogsService,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '@teensyrom-nx/application';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('PlayerViewComponent', () => {
  let component: PlayerViewComponent;
  let fixture: ComponentFixture<PlayerViewComponent>;

  const mockDeviceService: Partial<IDeviceService> = {
    findDevices: () => of([]),
  };

  const mockStorageService: Partial<IStorageService> = {};

  const mockDeviceLogsService: Partial<IDeviceLogsService> = {};

  const mockDeviceStore = {
    devices: signal([]),
    isLoading: signal(false),
    hasEnabledDevices: signal(false),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerViewComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
        { provide: DEVICE_LOGS_SERVICE, useValue: mockDeviceLogsService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: {} },
        { provide: DeviceStore, useValue: mockDeviceStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have stores injected', () => {
    expect(component.deviceStore).toBeTruthy();
  });

  it('should compute enabled devices', () => {
    expect(component.enabledDevices).toBeTruthy();
    expect(component.enabledDevices()).toEqual([]);
  });
});
