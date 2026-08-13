import { StorageKeyUtil, type HistoryEntry } from '@teensyrom-nx/application';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { FileItemType, StorageType } from '@teensyrom-nx/domain';
import { StorageItemActionsComponent, StorageItemComponent } from '@teensyrom-nx/ui/components';
import { renderPlayerComponent } from '../../../../../../testing/render-player-component';
import { HistoryEntryComponent } from './history-entry.component';

function createTestHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    file: createTestFileItem(),
    storageKey: StorageKeyUtil.create('device-1', StorageType.Usb),
    parentPath: '/test',
    timestamp: Date.now(),
    isCompatible: true,
    ...overrides,
  };
}

describe('HistoryEntryComponent', () => {
  function render(inputs: Record<string, unknown>) {
    // The selected class (a @HostBinding on StorageItemComponent), the click/dblclick
    // emissions (re-emitted from StorageItemComponent's own host listeners), and the
    // locale-formatted timestamp (rendered by StorageItemActionsComponent's own template)
    // are facts only the real children can produce.
    return renderPlayerComponent(HistoryEntryComponent, {
      inputs,
      realChildren: [StorageItemComponent, StorageItemActionsComponent],
    });
  }

  it('creates the component', () => {
    const { component } = render({ entry: createTestHistoryEntry() });
    expect(component).toBeTruthy();
  });

  it('renders the entry file name', () => {
    const entry = createTestHistoryEntry({ file: createTestFileItem({ name: 'test-song.sid' }) });
    const { fixture } = render({ entry });
    expect(fixture.nativeElement.textContent).toContain('test-song');
  });

  it('renders the timestamp in a locale-formatted form', () => {
    const testDate = new Date(2025, 9, 9, 15, 45, 0);
    const entry = createTestHistoryEntry({ timestamp: testDate.getTime() });
    const { fixture } = render({ entry });
    expect(fixture.nativeElement.textContent).toMatch(/3:45\s*PM/);
  });

  it('maps Song to the music_note icon', () => {
    const entry = createTestHistoryEntry({ file: createTestFileItem({ type: FileItemType.Song }) });
    const { component } = render({ entry });
    expect(component.fileIcon()).toBe('music_note');
  });

  it('maps Game to the sports_esports icon', () => {
    const entry = createTestHistoryEntry({ file: createTestFileItem({ type: FileItemType.Game }) });
    const { component } = render({ entry });
    expect(component.fileIcon()).toBe('sports_esports');
  });

  it('maps Image to the image icon', () => {
    const entry = createTestHistoryEntry({ file: createTestFileItem({ type: FileItemType.Image }) });
    const { component } = render({ entry });
    expect(component.fileIcon()).toBe('image');
  });

  it('maps Hex to the code icon', () => {
    const entry = createTestHistoryEntry({ file: createTestFileItem({ type: FileItemType.Hex }) });
    const { component } = render({ entry });
    expect(component.fileIcon()).toBe('code');
  });

  it('maps Unknown to the insert_drive_file icon', () => {
    const entry = createTestHistoryEntry({ file: createTestFileItem({ type: FileItemType.Unknown }) });
    const { component } = render({ entry });
    expect(component.fileIcon()).toBe('insert_drive_file');
  });

  it('emits entrySelected with the entry on click', () => {
    const entry = createTestHistoryEntry();
    const { component, fixture } = render({ entry });

    let emitted: unknown;
    component.entrySelected.subscribe((e) => (emitted = e));
    fixture.nativeElement.querySelector('lib-storage-item').click();

    expect(emitted).toEqual(entry);
  });

  it('emits entryDoubleClick with the entry on double-click', () => {
    const entry = createTestHistoryEntry();
    const { component, fixture } = render({ entry });

    let emitted: unknown;
    component.entryDoubleClick.subscribe((e) => (emitted = e));
    fixture.nativeElement
      .querySelector('lib-storage-item')
      .dispatchEvent(new MouseEvent('dblclick'));

    expect(emitted).toEqual(entry);
  });

  it('applies the selected class when selected is true', () => {
    const { fixture } = render({ entry: createTestHistoryEntry(), selected: true });
    const item = fixture.nativeElement.querySelector('lib-storage-item');
    expect(item.classList.contains('selected')).toBe(true);
  });

  it('omits the selected class when selected is false', () => {
    const { fixture } = render({ entry: createTestHistoryEntry(), selected: false });
    const item = fixture.nativeElement.querySelector('lib-storage-item');
    expect(item.classList.contains('selected')).toBe(false);
  });
});
