import { signal } from '@angular/core';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { renderPlayerComponent } from '../../../../testing/render-player-component';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { StorageKeyUtil, type LaunchedFile } from '@teensyrom-nx/application';
import { FileItemType, StorageType } from '@teensyrom-nx/domain';
import { FileDescriptionComponent } from './file-description.component';

function createLaunchedFile(overrides: Parameters<typeof createTestFileItem>[0] = {}): LaunchedFile {
  return {
    storageKey: StorageKeyUtil.create('test-device', StorageType.Sd),
    file: createTestFileItem(overrides),
    parentPath: '/music',
    launchedAt: Date.now(),
    isCompatible: true,
  };
}

function render(currentFile: LaunchedFile | null) {
  return renderPlayerComponent(FileDescriptionComponent, {
    inputs: { deviceId: 'test-device' },
    playerContext: {
      getCurrentFile: vi.fn().mockReturnValue(signal(currentFile).asReadonly()),
    },
    providers: [{ provide: MatDialog, useValue: { open: vi.fn() } }],
  });
}

describe('FileDescriptionComponent', () => {
  it('creates', () => {
    const { component } = render(null);

    expect(component).toBeTruthy();
  });

  it('shows the empty state when no file is loaded', () => {
    const { component, fixture } = render(null);

    expect(component.hasFile()).toBe(false);
    expect(fixture.nativeElement.querySelector('.empty-icon')).toBeTruthy();
  });

  it('exposes the title from the current file metadata', () => {
    const { component } = render(createLaunchedFile({ title: 'Test Song Title' }));

    expect(component.displayTitle()).toBe('Test Song Title');
  });

  it('exposes the creator from the current file metadata', () => {
    const { component } = render(createLaunchedFile({ creator: 'Test Artist' }));

    expect(component.creator()).toBe('Test Artist');
  });

  it('forwards title/creator to the scaling-card child', () => {
    const { fixture } = render(
      createLaunchedFile({ title: 'Test Song Title', creator: 'Test Artist' })
    );

    const scalingCard = fixture.debugElement.query(By.css('lib-scaling-card'));
    expect(scalingCard.properties['title']).toBe('Test Song Title');
    expect(scalingCard.properties['subtitle']).toBe('Test Artist');
  });

  it('renders the description block when a description exists', () => {
    const { fixture } = render(createLaunchedFile({ description: 'A test description' }));

    expect(fixture.nativeElement.querySelector('.description-text')).toBeTruthy();
  });

  it('shows the HVSC STIL label for songs', () => {
    const { fixture } = render(
      createLaunchedFile({ type: FileItemType.Song, description: 'A test description' })
    );

    expect(fixture.nativeElement.querySelector('.section-label')).toBeTruthy();
  });

  it('falls back to the filename when no title is set', () => {
    const { component } = render(createLaunchedFile({ title: '', name: 'test-file.sid' }));

    expect(component.displayTitle()).toBe('test-file.sid');
  });

  it('renders release info when present', () => {
    const { fixture } = render(createLaunchedFile({ releaseInfo: '2024 Test Release' }));

    expect(fixture.nativeElement.querySelector('.release-info')).toBeTruthy();
  });

  describe('meta chips', () => {
    it('renders meta1 as a chip when present', () => {
      const { component, fixture } = render(createLaunchedFile({ meta1: 'PRG', meta2: '' }));

      expect(component.meta1()).toBe('PRG');
      const tagsSection = fixture.debugElement.query(By.css('.tags-section'));
      expect(tagsSection).toBeTruthy();
      const chips = tagsSection.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(1);
      expect(chips[0].nativeElement.textContent.trim()).toBe('PRG');
    });

    it('renders meta2 as a chip when present', () => {
      const { component, fixture } = render(createLaunchedFile({ meta1: '', meta2: 'C64' }));

      expect(component.meta2()).toBe('C64');
      const tagsSection = fixture.debugElement.query(By.css('.tags-section'));
      expect(tagsSection).toBeTruthy();
      const chips = tagsSection.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(1);
      expect(chips[0].nativeElement.textContent.trim()).toBe('C64');
    });

    it('renders both chips when meta1 and meta2 are both present', () => {
      const { fixture } = render(createLaunchedFile({ meta1: 'PRG', meta2: 'C64' }));

      const tagsSection = fixture.debugElement.query(By.css('.tags-section'));
      const chips = tagsSection.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(2);
    });

    it('renders no tags section when meta1, meta2, and tags are all empty', () => {
      const { fixture } = render(createLaunchedFile({ meta1: '', meta2: '', tags: [] }));

      expect(fixture.debugElement.query(By.css('.tags-section'))).toBeNull();
    });
  });

  describe('links', () => {
    it('renders the links section with items when links exist', () => {
      const { component, fixture } = render(
        createLaunchedFile({
          links: [
            { name: 'CSDb', url: 'https://csdb.dk/release/?id=12345' },
            { name: 'Pouët', url: 'https://pouet.net/prod.php?which=12345' },
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

  describe('hasContent / hasExtendedContent', () => {
    it('hasContent is true when title exists', () => {
      const { component } = render(createLaunchedFile({ title: 'Test Song' }));

      expect(component.hasContent()).toBe(true);
    });

    it('hasContent and hasExtendedContent are true when links exist', () => {
      const { component } = render(
        createLaunchedFile({ title: '', links: [{ name: 'Link', url: 'http://example.com' }] })
      );

      expect(component.hasContent()).toBe(true);
      expect(component.hasExtendedContent()).toBe(true);
    });

    it('hasExtendedContent is true when avgRating exists', () => {
      const { component } = render(createLaunchedFile({ title: '', avgRating: 3.5 }));

      expect(component.hasExtendedContent()).toBe(true);
    });
  });
});
