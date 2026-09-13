import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DeviceState, StorageType, type Device } from '@teensyrom-nx/domain';
import { BrowseTreeComponent } from '@teensyrom-nx/ui/components';
import { DjBrowseTreesComponent } from './dj-browse-trees.component';

function device(deviceId: string, overrides: Partial<Device> = {}): Device {
  return {
    deviceId,
    comPort: 'COM3',
    name: `TeensyROM ${deviceId}`,
    fwVersion: '1.0.0',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: true, indexExists: true },
    ...overrides,
  };
}

function render(devices: readonly Device[]) {
  TestBed.configureTestingModule({ imports: [DjBrowseTreesComponent] });

  const fixture: ComponentFixture<DjBrowseTreesComponent> =
    TestBed.createComponent(DjBrowseTreesComponent);
  fixture.componentRef.setInput('devices', devices);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

describe('DjBrowseTreesComponent', () => {
  it('renders one browse tree per device and no extra root node', () => {
    const { fixture } = render([device('a'), device('b'), device('c')]);

    const trees = fixture.debugElement.queryAll(By.directive(BrowseTreeComponent));
    expect(trees.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.device-row').length).toBe(3);
  });

  it('builds each tree model from the device and its available storages', () => {
    const { fixture } = render([device('SGVISJTN', { name: 'Workbench' })]);

    const tree = fixture.debugElement.query(By.directive(BrowseTreeComponent))
      .componentInstance as BrowseTreeComponent;

    expect(tree.model()).toEqual({
      deviceId: 'SGVISJTN',
      label: 'Workbench',
      icon: 'desktop_windows',
      accessibleName: 'Device SGVISJTN',
      storages: [
        {
          storageType: StorageType.Sd,
          label: 'SD Storage',
          icon: 'sd_storage',
          accessibleName: 'SD Storage, Device SGVISJTN',
        },
        {
          storageType: StorageType.Usb,
          label: 'USB Storage',
          icon: 'usb',
          accessibleName: 'USB Storage, Device SGVISJTN',
        },
      ],
    });
  });

  it('omits an unavailable storage from the tree model', () => {
    const { fixture } = render([
      device('a', {
        usbStorage: { deviceId: 'a', type: StorageType.Usb, available: false, indexExists: false },
      }),
    ]);

    const tree = fixture.debugElement.query(By.directive(BrowseTreeComponent))
      .componentInstance as BrowseTreeComponent;

    expect(tree.model().storages.map((s) => s.storageType)).toEqual([StorageType.Sd]);
  });

  it('defaults every tree to expanded', () => {
    const { fixture } = render([device('a'), device('b')]);

    const trees = fixture.debugElement.queryAll(By.directive(BrowseTreeComponent));
    expect(trees.every((t) => (t.componentInstance as BrowseTreeComponent).expanded())).toBe(true);
  });

  it('collapses only the device whose tree emitted expandedChange(false)', () => {
    const { fixture, component } = render([device('a'), device('b')]);

    component.onExpandedChange('a', false);
    fixture.detectChanges();

    const trees = fixture.debugElement.queryAll(By.directive(BrowseTreeComponent));
    const treeFor = (deviceId: string) =>
      trees.find((t) => (t.componentInstance as BrowseTreeComponent).model().deviceId === deviceId)
        ?.componentInstance as BrowseTreeComponent;

    expect(treeFor('a').expanded()).toBe(false);
    expect(treeFor('b').expanded()).toBe(true);
  });

  it("marks the active device's matching storage as selected, and no others", () => {
    const { fixture } = render([device('a'), device('b')]);
    fixture.componentRef.setInput('activeStorage', { deviceId: 'b', storageType: StorageType.Usb });
    fixture.detectChanges();

    const trees = fixture.debugElement.queryAll(By.directive(BrowseTreeComponent));
    const treeFor = (deviceId: string) =>
      trees.find((t) => (t.componentInstance as BrowseTreeComponent).model().deviceId === deviceId)
        ?.componentInstance as BrowseTreeComponent;

    expect(treeFor('a').selectedStorageType()).toBeNull();
    expect(treeFor('b').selectedStorageType()).toBe(StorageType.Usb);
  });

  it('emits storageSelect with the owning device id when a tree selects a storage', () => {
    const { fixture, component } = render([device('a'), device('b')]);
    const emitted: unknown[] = [];
    component.storageSelect.subscribe((event) => emitted.push(event));

    const trees = fixture.debugElement.queryAll(By.directive(BrowseTreeComponent));
    const treeB = trees.find(
      (t) => (t.componentInstance as BrowseTreeComponent).model().deviceId === 'b'
    )?.componentInstance as BrowseTreeComponent;
    treeB.storageSelect.emit(StorageType.Sd);

    expect(emitted).toEqual([{ deviceId: 'b', storageType: StorageType.Sd }]);
  });
});
