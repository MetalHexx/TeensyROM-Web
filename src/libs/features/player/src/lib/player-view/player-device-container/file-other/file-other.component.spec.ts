import { signal } from '@angular/core';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { renderPlayerComponent } from '../../../../testing/render-player-component';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { StorageKeyUtil, type LaunchedFile } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { FileOtherComponent } from './file-other.component';

function createLaunchedFile(overrides: Parameters<typeof createTestFileItem>[0] = {}): LaunchedFile {
  return {
    storageKey: StorageKeyUtil.create('test-device', StorageType.Sd),
    file: createTestFileItem(overrides),
    parentPath: '/test',
    launchedAt: Date.now(),
    isCompatible: true,
  };
}

function render(currentFile: LaunchedFile | null) {
  const currentFileSignal = signal(currentFile);

  const result = renderPlayerComponent(FileOtherComponent, {
    inputs: { deviceId: 'test-device' },
    playerContext: {
      getCurrentFile: vi.fn().mockReturnValue(currentFileSignal.asReadonly()),
    },
    providers: [{ provide: MatDialog, useValue: { open: vi.fn() } }],
  });

  return { ...result, currentFileSignal };
}

describe('FileOtherComponent', () => {
  it('creates', () => {
    const { component } = render(null);

    expect(component).toBeTruthy();
  });

  it('reflects the deviceId input', () => {
    const { component } = render(null);

    expect(component.deviceId()).toBe('test-device');
  });

  it('shows the empty state when no file is loaded', () => {
    const { component, fixture } = render(null);

    expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
    expect(component.hasFile()).toBe(false);
  });

  it('populates meta chips and content flag from DeepSID data', () => {
    const { component } = render(createLaunchedFile({ meta1: 'SID', meta2: '6581', links: [{ name: 'CSDb', url: 'https://csdb.dk' }] }));

    expect(component.meta1()).toBe('SID');
    expect(component.meta2()).toBe('6581');
    expect(component.hasContent()).toBe(true);
    expect(component.hasFile()).toBe(true);
  });

  describe('meta chips', () => {
    it('renders meta1 as a chip when present', () => {
      const { component, fixture } = render(createLaunchedFile({ meta1: 'PRG', meta2: '' }));

      expect(component.meta1()).toBe('PRG');
      const chips = fixture.debugElement.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(1);
      expect(chips[0].nativeElement.textContent.trim()).toBe('PRG');
    });

    it('renders meta2 as a chip when present', () => {
      const { component, fixture } = render(createLaunchedFile({ meta1: '', meta2: 'C64' }));

      expect(component.meta2()).toBe('C64');
      const chips = fixture.debugElement.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(1);
      expect(chips[0].nativeElement.textContent.trim()).toBe('C64');
    });

    it('renders both chips when meta1 and meta2 are both present', () => {
      const { fixture } = render(createLaunchedFile({ meta1: 'PRG', meta2: 'C64' }));

      const chips = fixture.debugElement.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(2);
    });

    it('renders no chip-set when meta1, meta2, and tags are all empty', () => {
      const { fixture } = render(createLaunchedFile({ meta1: '', meta2: '', tags: [] }));

      expect(fixture.debugElement.query(By.css('mat-chip-set'))).toBeNull();
    });
  });

  it('shows a no-metadata message when the file has no DeepSID content', () => {
    const { component, fixture } = render(
      createLaunchedFile({ meta1: '', meta2: '', links: [], tags: [], youTubeVideos: [], competitions: [], avgRating: undefined })
    );

    expect(component.hasContent()).toBe(false);
    expect(fixture.nativeElement.querySelector('.no-metadata')).toBeTruthy();
  });

  it('hasContent is true when links exist', () => {
    const { component } = render(
      createLaunchedFile({ links: [{ name: 'Link', url: 'http://example.com' }] })
    );

    expect(component.hasContent()).toBe(true);
  });

  it('hasContent is true when avgRating exists', () => {
    const { component } = render(createLaunchedFile({ avgRating: 4.0 }));

    expect(component.hasContent()).toBe(true);
  });

  it('hasContent is true when tags exist', () => {
    const { component } = render(createLaunchedFile({ tags: [{ name: 'Chiptune', type: 'genre' }] }));

    expect(component.hasContent()).toBe(true);
  });

  it('hasContent is true when YouTube videos exist', () => {
    const { component } = render(
      createLaunchedFile({
        youTubeVideos: [{ videoId: 'abc', url: 'http://youtube.com', channel: 'Channel', subtune: 0 }],
      })
    );

    expect(component.hasContent()).toBe(true);
  });

  it('hasContent is true when competitions exist', () => {
    const { component } = render(createLaunchedFile({ competitions: [{ name: 'Competition', place: 1 }] }));

    expect(component.hasContent()).toBe(true);
  });

  it('meta signals are empty strings when no file is loaded', () => {
    const { component } = render(null);

    expect(component.meta1()).toBe('');
    expect(component.meta2()).toBe('');
  });

  it('updates computed meta values reactively when the current file changes', () => {
    const { component, currentFileSignal, fixture } = render(
      createLaunchedFile({ meta1: 'PRG', meta2: 'C64' })
    );

    expect(component.meta1()).toBe('PRG');
    expect(component.meta2()).toBe('C64');

    currentFileSignal.set(createLaunchedFile({ meta1: 'D64', meta2: 'VIC20' }));
    fixture.detectChanges();

    expect(component.meta1()).toBe('D64');
    expect(component.meta2()).toBe('VIC20');
  });

  describe('links', () => {
    it('renders the links section with items when links exist', () => {
      const { component, fixture } = render(
        createLaunchedFile({
          links: [
            { name: 'CSDb', url: 'https://csdb.dk' },
            { name: 'Pouët', url: 'https://pouet.net' },
          ],
        })
      );

      expect(component.links().length).toBe(2);
      const linksSection = fixture.debugElement.query(By.css('.links-section'));
      expect(linksSection).toBeTruthy();
      expect(linksSection.queryAll(By.css('lib-external-link')).length).toBe(2);
    });

    it('renders no links section when links is empty', () => {
      const { component, fixture } = render(createLaunchedFile({ links: [] }));

      expect(component.links().length).toBe(0);
      expect(fixture.debugElement.query(By.css('.links-section'))).toBeNull();
    });
  });

  describe('YouTube videos', () => {
    it('renders the YouTube section with items when videos exist', () => {
      const { component, fixture } = render(
        createLaunchedFile({
          youTubeVideos: [
            { videoId: 'abc123', url: 'https://youtube.com/watch?v=abc123', channel: 'C64 Music Channel', subtune: 0 },
            { videoId: 'def456', url: 'https://youtube.com/watch?v=def456', channel: 'Retro Gaming', subtune: 2 },
          ],
        })
      );

      expect(component.youTubeVideos().length).toBe(2);
      const videosSection = fixture.debugElement.query(By.css('.youtube-section'));
      expect(videosSection).toBeTruthy();
      expect(videosSection.queryAll(By.css('lib-action-link')).length).toBe(2);
    });

    it('renders no YouTube section when videos is empty', () => {
      const { component, fixture } = render(createLaunchedFile({ youTubeVideos: [] }));

      expect(component.youTubeVideos().length).toBe(0);
      expect(fixture.debugElement.query(By.css('.youtube-section'))).toBeNull();
    });
  });

  describe('competitions', () => {
    it('renders the competitions section with items when competitions exist', () => {
      const { component, fixture } = render(
        createLaunchedFile({
          competitions: [{ name: 'X Party 2024', place: 1 }, { name: 'Demo Scene Awards' }],
        })
      );

      expect(component.competitions().length).toBe(2);
      const competitionsSection = fixture.debugElement.query(By.css('.competitions-section'));
      expect(competitionsSection).toBeTruthy();
      expect(competitionsSection.queryAll(By.css('.competition-item')).length).toBe(2);
    });

    it('renders a competition without a place with no position element', () => {
      const { fixture } = render(
        createLaunchedFile({ competitions: [{ name: 'Demo Scene Awards' }] })
      );

      const competitionItem = fixture.debugElement.query(By.css('.competition-item'));
      expect(competitionItem.query(By.css('.position'))).toBeNull();
    });

    it('renders no competitions section when competitions is empty', () => {
      const { component, fixture } = render(createLaunchedFile({ competitions: [] }));

      expect(component.competitions().length).toBe(0);
      expect(fixture.debugElement.query(By.css('.competitions-section'))).toBeNull();
    });
  });

  describe('tags', () => {
    it('renders the tags section with typed chips when tags exist', () => {
      const { component, fixture } = render(
        createLaunchedFile({
          tags: [
            { name: 'Chiptune', type: 'genre' },
            { name: 'Classic', type: 'era' },
          ],
        })
      );

      expect(component.tags().length).toBe(2);
      const tagsSection = fixture.debugElement.query(By.css('.tags-section'));
      expect(tagsSection).toBeTruthy();
      const chips = tagsSection.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(2);
      expect(chips[0].nativeElement.classList.contains('tag-genre')).toBe(true);
      expect(chips[1].nativeElement.classList.contains('tag-era')).toBe(true);
    });

    it('renders no tags section when tags is empty', () => {
      const { component, fixture } = render(createLaunchedFile({ tags: [] }));

      expect(component.tags().length).toBe(0);
      expect(fixture.debugElement.query(By.css('.tags-section'))).toBeNull();
    });
  });

  describe('ratings', () => {
    it('renders the rating section with formatted values when avgRating exists', () => {
      const { component, fixture } = render(
        createLaunchedFile({ avgRating: 4.5, ratingCount: 42 })
      );

      expect(component.avgRating()).toBe(4.5);
      expect(component.ratingCount()).toBe(42);
      const ratingSection = fixture.debugElement.query(By.css('.rating-section'));
      expect(ratingSection).toBeTruthy();
      expect(ratingSection.nativeElement.textContent).toContain('4.5/5.0');
      expect(ratingSection.nativeElement.textContent).toContain('(42 ratings)');
    });

    it('renders no rating section when avgRating is undefined', () => {
      const { component, fixture } = render(createLaunchedFile({ avgRating: undefined }));

      expect(component.avgRating()).toBeUndefined();
      expect(fixture.debugElement.query(By.css('.rating-section'))).toBeNull();
    });
  });

  it('renders the metadata grid when any section exists', () => {
    const { fixture } = render(createLaunchedFile({ tags: [{ name: 'Chiptune', type: 'genre' }] }));

    expect(fixture.nativeElement.querySelector('.metadata-grid')).toBeTruthy();
  });
});
