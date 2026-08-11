import { By } from '@angular/platform-browser';
import { renderPlayerComponent } from '../../../../../../testing/render-player-component';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { FileItemType } from '@teensyrom-nx/domain';
import { StorageItemComponent, TooltipDirective, TooltipPosition } from '@teensyrom-nx/ui/components';
import { FileItemComponent } from './file-item.component';

describe('FileItemComponent', () => {
  function render(inputs: Record<string, unknown>) {
    // The selected class (a @HostBinding on StorageItemComponent) and the tooltip (a directive
    // that must actually be attached) are facts only the real children can produce.
    return renderPlayerComponent(FileItemComponent, {
      inputs,
      realChildren: [StorageItemComponent, TooltipDirective],
    });
  }

  it('creates the component', () => {
    const { component } = render({ fileItem: createTestFileItem({ type: FileItemType.Unknown }) });
    expect(component).toBeTruthy();
  });

  it('maps Unknown to the insert_drive_file icon', () => {
    const { component } = render({ fileItem: createTestFileItem({ type: FileItemType.Unknown }) });
    expect(component.fileIcon()).toBe('insert_drive_file');
  });

  it('maps Song to the music_note icon', () => {
    const { component } = render({ fileItem: createTestFileItem({ type: FileItemType.Song }) });
    expect(component.fileIcon()).toBe('music_note');
  });

  it('maps Game to the sports_esports icon', () => {
    const { component } = render({ fileItem: createTestFileItem({ type: FileItemType.Game }) });
    expect(component.fileIcon()).toBe('sports_esports');
  });

  it('maps Image to the image icon', () => {
    const { component } = render({ fileItem: createTestFileItem({ type: FileItemType.Image }) });
    expect(component.fileIcon()).toBe('image');
  });

  it('maps Hex to the code icon', () => {
    const { component } = render({ fileItem: createTestFileItem({ type: FileItemType.Hex }) });
    expect(component.fileIcon()).toBe('code');
  });

  it('formats 0 bytes as "0 B"', () => {
    const { component } = render({ fileItem: createTestFileItem({ size: 0 }) });
    expect(component.formattedSize()).toBe('0 B');
  });

  it('formats sub-KB sizes with a B suffix', () => {
    const { component } = render({ fileItem: createTestFileItem({ size: 512 }) });
    expect(component.formattedSize()).toBe('512.0 B');
  });

  it('formats KB-range sizes with a KB suffix', () => {
    const { component } = render({ fileItem: createTestFileItem({ size: 1536 }) });
    expect(component.formattedSize()).toBe('1.5 KB');
  });

  it('formats MB-range sizes with an MB suffix', () => {
    const { component } = render({ fileItem: createTestFileItem({ size: 2359296 }) });
    expect(component.formattedSize()).toBe('2.3 MB');
  });

  it('formats GB-range sizes with a GB suffix', () => {
    const { component } = render({ fileItem: createTestFileItem({ size: 3221225472 }) });
    expect(component.formattedSize()).toBe('3.0 GB');
  });

  it('emits itemSelected with the file on click', () => {
    const file = createTestFileItem({ type: FileItemType.Song });
    const { component, fixture } = render({ fileItem: file });

    let emitted: unknown;
    component.itemSelected.subscribe((item) => (emitted = item));
    fixture.nativeElement.querySelector('lib-storage-item').click();

    expect(emitted).toEqual(file);
  });

  it('emits itemDoubleClick with the file on double-click', () => {
    const file = createTestFileItem({ type: FileItemType.Game });
    const { component, fixture } = render({ fileItem: file });

    let emitted: unknown;
    component.itemDoubleClick.subscribe((item) => (emitted = item));
    fixture.nativeElement
      .querySelector('lib-storage-item')
      .dispatchEvent(new MouseEvent('dblclick'));

    expect(emitted).toEqual(file);
  });

  it('applies the selected class when selected is true', () => {
    const { fixture } = render({ fileItem: createTestFileItem(), selected: true });
    const item = fixture.nativeElement.querySelector('lib-storage-item');
    expect(item.classList.contains('selected')).toBe(true);
  });

  it('omits the selected class when selected is false', () => {
    const { fixture } = render({ fileItem: createTestFileItem(), selected: false });
    const item = fixture.nativeElement.querySelector('lib-storage-item');
    expect(item.classList.contains('selected')).toBe(false);
  });

  it('renders the file name', () => {
    const file = createTestFileItem({ name: 'test-file.sid' });
    const { fixture } = render({ fileItem: file });
    expect(fixture.nativeElement.textContent).toContain('test-file');
  });

  describe('incompatibility indicator', () => {
    it('shows the icon for an incompatible file', () => {
      const { fixture } = render({ fileItem: createTestFileItem({ isCompatible: false }) });
      expect(fixture.nativeElement.querySelector('.incompatible-icon')).toBeTruthy();
    });

    it('hides the icon for a compatible file', () => {
      const { fixture } = render({ fileItem: createTestFileItem({ isCompatible: true }) });
      expect(fixture.nativeElement.querySelector('.incompatible-icon')).toBeNull();
    });

    it('hides the icon when isCompatible is undefined', () => {
      const { fixture } = render({ fileItem: createTestFileItem({ isCompatible: undefined }) });
      expect(fixture.nativeElement.querySelector('.incompatible-icon')).toBeNull();
    });

    it('applies the tooltip directive to the icon', () => {
      const { fixture } = render({ fileItem: createTestFileItem({ isCompatible: false }) });
      const iconElement = fixture.debugElement.query(By.css('.incompatible-icon'));
      expect(iconElement.injector.get(TooltipDirective, null)).toBeTruthy();
    });

    it('sets the tooltip position to Right', () => {
      const { fixture } = render({ fileItem: createTestFileItem({ isCompatible: false }) });
      const iconElement = fixture.debugElement.query(By.css('.incompatible-icon'));
      const tooltip = iconElement.injector.get(TooltipDirective);
      expect(tooltip.libTooltip()?.position).toBe(TooltipPosition.Right);
    });
  });
});
