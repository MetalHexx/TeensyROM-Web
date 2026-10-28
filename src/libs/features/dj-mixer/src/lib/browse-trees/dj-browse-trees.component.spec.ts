import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  DeviceState,
  StorageType,
  type Device,
  DeviceMachine,
  DeviceVideoStandard,
  DeviceHardwareVariant,
} from '@teensyrom-nx/domain';
import { BrowseTreeComponent } from '@teensyrom-nx/ui/components';
import { SetsTreeBranchComponent, type SetsTreeBranchModel } from '@teensyrom-nx/ui/components/dj';
import { DjBrowseTreesComponent } from './dj-browse-trees.component';

function device(deviceId: string, overrides: Partial<Device> = {}): Device {
  return {
    deviceId,
    comPort: 'COM3',
    name: `TeensyROM ${deviceId}`,
    fwVersion: '1.0.0',
    machine: DeviceMachine.C64,
    videoStandard: DeviceVideoStandard.Ntsc,
    todClockHz: null,
    hardwareVariant: DeviceHardwareVariant.TeensyRom,
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: true, indexExists: true },
    ...overrides,
  };
}

const SETS: SetsTreeBranchModel = {
  label: 'Sets',
  sets: [
    { id: 's2', name: 'Friday', loaded: true, accessibleName: 'Set Friday, loaded' },
    { id: 's1', name: 'Saturday', loaded: false, accessibleName: 'Set Saturday' },
  ],
};

function render(devices: readonly Device[], sets: SetsTreeBranchModel = SETS) {
  TestBed.configureTestingModule({ imports: [DjBrowseTreesComponent] });

  const fixture: ComponentFixture<DjBrowseTreesComponent> =
    TestBed.createComponent(DjBrowseTreesComponent);
  fixture.componentRef.setInput('devices', devices);
  fixture.componentRef.setInput('sets', sets);
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

  it('builds each tree model from the device and its available storages, labelling it by device name', () => {
    const { fixture } = render([device('SGVISJTN', { name: 'Workbench' })]);

    const tree = fixture.debugElement.query(By.directive(BrowseTreeComponent))
      .componentInstance as BrowseTreeComponent;

    expect(tree.model()).toEqual({
      deviceId: 'SGVISJTN',
      label: 'Workbench',
      icon: 'desktop_windows',
      accessibleName: 'Device Workbench',
      storages: [
        {
          storageType: StorageType.Sd,
          label: 'SD Storage',
          icon: 'sd_storage',
          accessibleName: 'SD Storage, Workbench',
        },
        {
          storageType: StorageType.Usb,
          label: 'USB Storage',
          icon: 'usb',
          accessibleName: 'USB Storage, Workbench',
        },
      ],
    });
  });

  it('relabels the tree and its storages when the device input carries a new name, keeping the device id key', () => {
    const { fixture } = render([device('SGVISJTN', { name: 'TR-1' })]);
    fixture.componentRef.setInput('devices', [device('SGVISJTN', { name: 'Living Room' })]);
    fixture.detectChanges();

    const tree = fixture.debugElement.query(By.directive(BrowseTreeComponent))
      .componentInstance as BrowseTreeComponent;

    expect(tree.model().deviceId).toBe('SGVISJTN');
    expect(tree.model().label).toBe('Living Room');
    expect(tree.model().accessibleName).toBe('Device Living Room');
    expect(tree.model().storages.map((s) => s.accessibleName)).toEqual([
      'SD Storage, Living Room',
      'USB Storage, Living Room',
    ]);
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

  describe('the Sets branch', () => {
    function branch(fixture: ComponentFixture<DjBrowseTreesComponent>): SetsTreeBranchComponent {
      return fixture.debugElement.query(By.directive(SetsTreeBranchComponent))
        .componentInstance as SetsTreeBranchComponent;
    }

    it('renders above the device trees', () => {
      const { fixture } = render([device('a')]);
      const children = Array.from(fixture.nativeElement.children as HTMLCollection).map((el) =>
        el.tagName.toLowerCase()
      );

      expect(children).toEqual(['lib-sets-tree-branch', 'lib-browse-tree']);
      expect(branch(fixture).model()).toEqual(SETS);
    });

    it('renders with no devices', () => {
      const { fixture } = render([]);

      expect(branch(fixture).model()).toEqual(SETS);
    });

    it('starts expanded and follows the branch row', () => {
      const { fixture } = render([]);
      expect(branch(fixture).expanded()).toBe(true);

      branch(fixture).expandedChange.emit(false);
      fixture.detectChanges();

      expect(branch(fixture).expanded()).toBe(false);
    });

    it('emits setSelect with the chosen set id', () => {
      const { fixture, component } = render([]);
      const emitted: string[] = [];
      component.setSelect.subscribe((id) => emitted.push(id));

      branch(fixture).setSelect.emit('s1');

      expect(emitted).toEqual(['s1']);
    });
  });
});
