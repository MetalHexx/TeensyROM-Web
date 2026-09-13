import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { StorageType } from '@teensyrom-nx/domain';
import { BrowseTreeComponent, BrowseTreeModel } from './browse-tree.component';

@Component({
  standalone: true,
  imports: [BrowseTreeComponent],
  template: `
    <lib-browse-tree
      [model]="model()"
      [expanded]="expanded()"
      [selectedStorageType]="selectedStorageType()"
      (expandedChange)="onExpandedChange($event)"
      (storageSelect)="onStorageSelect($event)"
    />
  `,
})
class TestHostComponent {
  model = signal<BrowseTreeModel>({
    deviceId: 'TEST-DEVICE',
    label: 'Test Device',
    icon: 'desktop_windows',
    accessibleName: 'Device TEST-DEVICE',
    storages: [
      {
        storageType: StorageType.Sd,
        label: 'SD Storage',
        icon: 'sd_storage',
        accessibleName: 'SD Storage, Device TEST-DEVICE',
      },
      {
        storageType: StorageType.Usb,
        label: 'USB Storage',
        icon: 'usb',
        accessibleName: 'USB Storage, Device TEST-DEVICE',
      },
    ],
  });
  expanded = signal(true);
  selectedStorageType = signal<StorageType | null>(null);
  expandedChangeValue: boolean | null = null;
  selectedStorageTypeValue: StorageType | null = null;

  onExpandedChange(expanded: boolean): void {
    this.expandedChangeValue = expanded;
  }

  onStorageSelect(storageType: StorageType): void {
    this.selectedStorageTypeValue = storageType;
  }
}

describe('BrowseTreeComponent', () => {
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  const mockModel: BrowseTreeModel = {
    deviceId: 'TEST-DEVICE',
    label: 'Test Device',
    icon: 'desktop_windows',
    accessibleName: 'Device TEST-DEVICE',
    storages: [
      {
        storageType: StorageType.Sd,
        label: 'SD Storage',
        icon: 'sd_storage',
        accessibleName: 'SD Storage, Device TEST-DEVICE',
      },
      {
        storageType: StorageType.Usb,
        label: 'USB Storage',
        icon: 'usb',
        accessibleName: 'USB Storage, Device TEST-DEVICE',
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, BrowseTreeComponent],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
  });

  describe('render', () => {
    it('should render storage leaves with given labels', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const storageElements = hostFixture.nativeElement.querySelectorAll('.storage-row');
      expect(storageElements.length).toBe(2);
      expect(storageElements[0].textContent).toContain('SD Storage');
      expect(storageElements[1].textContent).toContain('USB Storage');
    });

    it('should hide storage leaves when collapsed', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(false);
      hostFixture.detectChanges();

      const storageList = hostFixture.nativeElement.querySelector('.storage-list');
      expect(storageList).toBeNull();
    });

    it('should render device row with device label', () => {
      hostComponent.model.set(mockModel);
      hostFixture.detectChanges();

      const deviceButton = hostFixture.nativeElement.querySelector('.device-row');
      expect(deviceButton).toBeTruthy();
      expect(deviceButton.textContent).toContain('Test Device');
    });

    it('should set aria-expanded to true when expanded', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const deviceButton = hostFixture.nativeElement.querySelector('.device-row');
      expect(deviceButton.getAttribute('aria-expanded')).toBe('true');
    });

    it('should set aria-expanded to false when collapsed', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(false);
      hostFixture.detectChanges();

      const deviceButton = hostFixture.nativeElement.querySelector('.device-row');
      expect(deviceButton.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('device row click', () => {
    it('should emit expandedChange(false) when device row clicked while expanded', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const deviceButton = hostFixture.nativeElement.querySelector('.device-row');
      deviceButton.click();

      expect(hostComponent.expandedChangeValue).toBe(false);
    });

    it('should emit expandedChange(true) when device row clicked while collapsed', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(false);
      hostFixture.detectChanges();

      const deviceButton = hostFixture.nativeElement.querySelector('.device-row');
      deviceButton.click();

      expect(hostComponent.expandedChangeValue).toBe(true);
    });

    it('should emit expandedChange on Enter key', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const deviceButton = hostFixture.debugElement.query(By.css('.device-row'));
      deviceButton.triggerEventHandler('keydown.enter', {});

      expect(hostComponent.expandedChangeValue).toBe(false);
    });

    it('should emit expandedChange on Space key', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const deviceButton = hostFixture.debugElement.query(By.css('.device-row'));
      deviceButton.triggerEventHandler('keydown.space', {});

      expect(hostComponent.expandedChangeValue).toBe(false);
    });
  });

  describe('storage selection', () => {
    it('should emit storageSelect with storage type on click', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const storageButtons = hostFixture.nativeElement.querySelectorAll('.storage-row');
      storageButtons[0].click();

      expect(hostComponent.selectedStorageTypeValue).toBe(StorageType.Sd);
    });

    it('should emit storageSelect on Enter key', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const storageButtons = hostFixture.debugElement.queryAll(By.css('.storage-row'));
      storageButtons[1].triggerEventHandler('keydown.enter', {});

      expect(hostComponent.selectedStorageTypeValue).toBe(StorageType.Usb);
    });

    it('should emit storageSelect on Space key', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const storageButtons = hostFixture.debugElement.queryAll(By.css('.storage-row'));
      storageButtons[0].triggerEventHandler('keydown.space', {});

      expect(hostComponent.selectedStorageTypeValue).toBe(StorageType.Sd);
    });

    it('should set aria-selected to true for selected storage', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostComponent.selectedStorageType.set(StorageType.Sd);
      hostFixture.detectChanges();

      const storageButtons = hostFixture.nativeElement.querySelectorAll('.storage-row');
      expect(storageButtons[0].getAttribute('aria-selected')).toBe('true');
      expect(storageButtons[1].getAttribute('aria-selected')).toBe('false');
    });

    it('should set aria-selected to false when no storage selected', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostComponent.selectedStorageType.set(null);
      hostFixture.detectChanges();

      const storageButtons = hostFixture.nativeElement.querySelectorAll('.storage-row');
      expect(storageButtons[0].getAttribute('aria-selected')).toBe('false');
      expect(storageButtons[1].getAttribute('aria-selected')).toBe('false');
    });

    it('should set aria-label on storage rows', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const storageButtons = hostFixture.nativeElement.querySelectorAll('.storage-row');
      expect(storageButtons[0].getAttribute('aria-label')).toBe('SD Storage, Device TEST-DEVICE');
      expect(storageButtons[1].getAttribute('aria-label')).toBe('USB Storage, Device TEST-DEVICE');
    });
  });

  describe('selected state styling', () => {
    it('should pass isSelected to DirectoryTreeNode for selected storage', () => {
      hostComponent.model.set(mockModel);
      hostComponent.expanded.set(true);
      hostComponent.selectedStorageType.set(StorageType.Usb);
      hostFixture.detectChanges();

      const storageButtons = hostFixture.nativeElement.querySelectorAll('.storage-row');
      expect(storageButtons[1].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('single storage', () => {
    it('should render single storage correctly', () => {
      const singleStorageModel: BrowseTreeModel = {
        ...mockModel,
        storages: [mockModel.storages[0]],
      };
      hostComponent.model.set(singleStorageModel);
      hostComponent.expanded.set(true);
      hostFixture.detectChanges();

      const storageElements = hostFixture.nativeElement.querySelectorAll('.storage-row');
      expect(storageElements.length).toBe(1);
      expect(storageElements[0].textContent).toContain('SD Storage');
    });
  });
});
