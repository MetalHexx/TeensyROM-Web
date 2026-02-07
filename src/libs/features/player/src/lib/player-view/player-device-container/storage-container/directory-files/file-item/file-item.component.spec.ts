import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { FileItemComponent } from './file-item.component';
import { FileItem, FileItemType, StorageType } from '@teensyrom-nx/domain';
import { TooltipDirective, TooltipPosition } from '@teensyrom-nx/ui/components';

describe('FileItemComponent', () => {
  let component: FileItemComponent;
  let fixture: ComponentFixture<FileItemComponent>;

  const createMockFileItem = (
    type: FileItemType,
    size: number,
    overrides: Partial<FileItem> = {}
  ): FileItem => ({
    name: 'test-file',
    path: '/test/path',
    size,
    type,
    isFavorite: false,
    isCompatible: true,
    title: '',
    creator: '',
    releaseInfo: '',
    description: '',
    shareUrl: '',
    metadataSource: '',
    meta1: '',
    meta2: '',
    metadataSourcePath: '',
    parentPath: '',
    playLength: '',
    subtuneLengths: [],
    startSubtuneNum: 0,
    images: [],
    storageType: StorageType.Sd,
    links: [],
    tags: [],
    youTubeVideos: [],
    competitions: [],
    ratingCount: 0,
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideNoopAnimations()],
      imports: [FileItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileItemComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 0));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should map Unknown to insert_drive_file icon', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 0));
    fixture.detectChanges();
    expect(component.fileIcon()).toBe('insert_drive_file');
  });

  it('should map Song to music_note icon', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Song, 0));
    fixture.detectChanges();
    expect(component.fileIcon()).toBe('music_note');
  });

  it('should map Game to sports_esports icon', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Game, 0));
    fixture.detectChanges();
    expect(component.fileIcon()).toBe('sports_esports');
  });

  it('should map Image to image icon', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Image, 0));
    fixture.detectChanges();
    expect(component.fileIcon()).toBe('image');
  });

  it('should map Hex to code icon', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Hex, 0));
    fixture.detectChanges();
    expect(component.fileIcon()).toBe('code');
  });

  it('should format 0 bytes correctly', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 0));
    fixture.detectChanges();
    expect(component.formattedSize()).toBe('0 B');
  });

  it('should format bytes correctly', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 512));
    fixture.detectChanges();
    expect(component.formattedSize()).toBe('512.0 B');
  });

  it('should format kilobytes correctly', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 1536));
    fixture.detectChanges();
    expect(component.formattedSize()).toBe('1.5 KB');
  });

  it('should format megabytes correctly', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 2359296));
    fixture.detectChanges();
    expect(component.formattedSize()).toBe('2.3 MB');
  });

  it('should format gigabytes correctly', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 3221225472));
    fixture.detectChanges();
    expect(component.formattedSize()).toBe('3.0 GB');
  });

  it('should emit itemSelected on click', () => {
    const mockFile = createMockFileItem(FileItemType.Song, 1024);
    fixture.componentRef.setInput('fileItem', mockFile);
    fixture.detectChanges();

    let emittedItem: FileItem | undefined;
    component.itemSelected.subscribe((item) => {
      emittedItem = item;
    });

    const storageItemElement = fixture.nativeElement.querySelector('lib-storage-item');
    storageItemElement.click();

    expect(emittedItem).toEqual(mockFile);
  });

  it('should emit itemDoubleClick on double click', () => {
    const mockFile = createMockFileItem(FileItemType.Game, 2048);
    fixture.componentRef.setInput('fileItem', mockFile);
    fixture.detectChanges();

    let emittedItem: FileItem | undefined;
    component.itemDoubleClick.subscribe((item) => {
      emittedItem = item;
    });

    const storageItemElement = fixture.nativeElement.querySelector('lib-storage-item');
    storageItemElement.dispatchEvent(new MouseEvent('dblclick'));

    expect(emittedItem).toEqual(mockFile);
  });

  it('should apply selected class when selected is true', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 0));
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();

    const storageItemElement = fixture.nativeElement.querySelector('lib-storage-item');
    expect(storageItemElement.classList.contains('selected')).toBe(true);
  });

  it('should not apply selected class when selected is false', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 0));
    fixture.componentRef.setInput('selected', false);
    fixture.detectChanges();

    const storageItemElement = fixture.nativeElement.querySelector('lib-storage-item');
    expect(storageItemElement.classList.contains('selected')).toBe(false);
  });

  it('should render file name', () => {
    const mockFile = createMockFileItem(FileItemType.Song, 1024);
    fixture.componentRef.setInput('fileItem', mockFile);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('test-file');
  });

  it('should render formatted file size', () => {
    fixture.componentRef.setInput('fileItem', createMockFileItem(FileItemType.Unknown, 1536));
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('1.5 KB');
  });

  describe('Incompatibility Indicator', () => {
    it('should show icon when file is incompatible', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: false });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.incompatible-icon');
      expect(icon).toBeTruthy();
    });

    it('should hide icon when file is compatible', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: true });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.incompatible-icon');
      expect(icon).toBeNull();
    });

    it('should hide icon when isCompatible is undefined', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: undefined });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.incompatible-icon');
      expect(icon).toBeNull();
    });

    it('should use correct Material icon name', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: false });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.incompatible-icon');
      expect(icon.textContent?.trim()).toBe('sentiment_very_dissatisfied');
    });

    it('should have tooltip directive applied', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: false });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      const iconElement = fixture.debugElement.query(By.css('.incompatible-icon'));
      const tooltipDirective = iconElement.injector.get(TooltipDirective, null);
      expect(tooltipDirective).toBeTruthy();
    });

    it('should have correct tooltip body text', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: false });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      const iconElement = fixture.debugElement.query(By.css('.incompatible-icon'));
      const tooltipDirective = iconElement.injector.get(TooltipDirective);
      expect(tooltipDirective.libTooltip().body).toBe(
        'File is incompatible with TeensyROM hardware'
      );
    });

    it('should have tooltip position set to Right', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: false });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      const iconElement = fixture.debugElement.query(By.css('.incompatible-icon'));
      const tooltipDirective = iconElement.injector.get(TooltipDirective);
      expect(tooltipDirective.libTooltip().position).toBe(TooltipPosition.Right);
    });

    it('should reactively show icon when file becomes incompatible', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: true });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      // Initially no icon
      let icon = fixture.nativeElement.querySelector('.incompatible-icon');
      expect(icon).toBeNull();

      // Update to incompatible
      const incompatibleFile = createMockFileItem(FileItemType.Song, 1024, {
        isCompatible: false,
      });
      fixture.componentRef.setInput('fileItem', incompatibleFile);
      fixture.detectChanges();

      // Icon should now be visible
      icon = fixture.nativeElement.querySelector('.incompatible-icon');
      expect(icon).toBeTruthy();
    });

    it('should reactively hide icon when file becomes compatible', () => {
      const mockFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: false });
      fixture.componentRef.setInput('fileItem', mockFile);
      fixture.detectChanges();

      // Initially icon is shown
      let icon = fixture.nativeElement.querySelector('.incompatible-icon');
      expect(icon).toBeTruthy();

      // Update to compatible
      const compatibleFile = createMockFileItem(FileItemType.Song, 1024, { isCompatible: true });
      fixture.componentRef.setInput('fileItem', compatibleFile);
      fixture.detectChanges();

      // Icon should now be hidden
      icon = fixture.nativeElement.querySelector('.incompatible-icon');
      expect(icon).toBeNull();
    });
  });
});
