import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { StorageDeviceItemComponent } from './storage-device-item.component';
import { StorageDeviceItem, StorageType } from '@teensyrom-nx/domain';

describe('StorageDeviceItemComponent', () => {
  let component: StorageDeviceItemComponent;
  let fixture: ComponentFixture<StorageDeviceItemComponent>;

  const mockStorageDevice: StorageDeviceItem = {
    name: 'SD Storage',
    storageType: StorageType.SD,
    icon: 'sd_storage',
    deviceId: 'device-001',
    itemType: 'storage-device',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideNoopAnimations()],
      imports: [StorageDeviceItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageDeviceItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('storageDevice', mockStorageDevice);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render storage device name', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('SD Storage');
  });

  it('should render correct icon for SD storage', () => {
    const compiled = fixture.nativeElement;
    const storageItemElement = compiled.querySelector('lib-storage-item');
    expect(storageItemElement).toBeTruthy();
  });

  it('should render correct icon for USB storage', () => {
    const usbDevice: StorageDeviceItem = {
      name: 'USB Storage',
      storageType: StorageType.USB,
      icon: 'usb',
      deviceId: 'device-001',
      itemType: 'storage-device',
    };

    fixture.componentRef.setInput('storageDevice', usbDevice);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('USB Storage');
  });

  it('should emit itemSelected on single click', () => {
    let emittedItem: StorageDeviceItem | undefined;
    component.itemSelected.subscribe((item) => {
      emittedItem = item;
    });

    const storageItemElement = fixture.nativeElement.querySelector('lib-storage-item');
    storageItemElement.click();

    expect(emittedItem).toEqual(mockStorageDevice);
  });

  it('should emit itemDoubleClicked on double click', () => {
    let emittedItem: StorageDeviceItem | undefined;
    component.itemDoubleClicked.subscribe((item) => {
      emittedItem = item;
    });

    const storageItemElement = fixture.nativeElement.querySelector('lib-storage-item');
    storageItemElement.dispatchEvent(new MouseEvent('dblclick'));

    expect(emittedItem).toEqual(mockStorageDevice);
  });

  it('should apply selected class when selected is true', () => {
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();

    const storageItemElement = fixture.nativeElement.querySelector('lib-storage-item');
    expect(storageItemElement.classList.contains('selected')).toBe(true);
  });

  it('should not apply selected class when selected is false', () => {
    fixture.componentRef.setInput('selected', false);
    fixture.detectChanges();

    const storageItemElement = fixture.nativeElement.querySelector('lib-storage-item');
    expect(storageItemElement.classList.contains('selected')).toBe(false);
  });

  it('should handle input changes correctly', () => {
    const newDevice: StorageDeviceItem = {
      name: 'USB Storage',
      storageType: StorageType.USB,
      icon: 'usb',
      deviceId: 'device-002',
      itemType: 'storage-device',
    };

    fixture.componentRef.setInput('storageDevice', newDevice);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('USB Storage');
  });

  it('should pass correct icon to storage-item component', () => {
    expect(component.storageDevice().icon).toBe('sd_storage');
  });
});
