import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { FileDescriptionComponent } from './file-description.component';
import { PLAYER_CONTEXT, IPlayerContext } from '@teensyrom-nx/application';
import { LaunchMode, PlayerStatus, FileItemType, StorageType } from '@teensyrom-nx/domain';

describe('FileDescriptionComponent', () => {
  let component: FileDescriptionComponent;
  let fixture: ComponentFixture<FileDescriptionComponent>;
  let mockPlayerContext: Partial<IPlayerContext>;
  let mockDialog: Partial<MatDialog>;
  let currentFileSignal: ReturnType<typeof signal>;

  beforeEach(async () => {
    currentFileSignal = signal(null);

    mockPlayerContext = {
      initializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      launchFileWithContext: vi.fn().mockResolvedValue(undefined),
      launchRandomFile: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      getCurrentFile: vi.fn().mockReturnValue(currentFileSignal.asReadonly()),
      getFileContext: vi.fn().mockReturnValue(signal(null).asReadonly()),
      getPlayerStatus: vi.fn().mockReturnValue(signal(PlayerStatus.Stopped).asReadonly()),
      getStatus: vi.fn().mockReturnValue(signal(PlayerStatus.Stopped).asReadonly()),
      isLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),
      getError: vi.fn().mockReturnValue(signal(null).asReadonly()),
      toggleShuffleMode: vi.fn(),
      setShuffleScope: vi.fn(),
      setFilterMode: vi.fn(),
      getLaunchMode: vi.fn().mockReturnValue(signal(LaunchMode.Directory).asReadonly()),
      getShuffleSettings: vi.fn().mockReturnValue(signal(null).asReadonly()),
      getTimerState: vi.fn().mockReturnValue(signal(null).asReadonly()),
      isCurrentFileCompatible: vi.fn().mockReturnValue(signal(true).asReadonly()),
      getPlayHistory: vi.fn().mockReturnValue(signal(null).asReadonly()),
      getCurrentHistoryPosition: vi.fn().mockReturnValue(signal(0).asReadonly()),
      canNavigateBackwardInHistory: vi.fn().mockReturnValue(signal(false).asReadonly()),
      canNavigateForwardInHistory: vi.fn().mockReturnValue(signal(false).asReadonly()),
      clearHistory: vi.fn(),
      toggleHistoryView: vi.fn(),
      isHistoryViewVisible: vi.fn().mockReturnValue(signal(false).asReadonly()),
      navigateToHistoryPosition: vi.fn().mockResolvedValue(undefined),
    };

    mockDialog = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: MatDialog, useValue: mockDialog },
      ],
      imports: [FileDescriptionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileDescriptionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'test-device');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Empty State', () => {
    it('should show empty state when no file is loaded', () => {
      currentFileSignal.set(null);
      fixture.detectChanges();

      expect(component.hasFile()).toBe(false);
      const emptyIcon = fixture.debugElement.query(By.css('.empty-icon'));
      expect(emptyIcon).toBeTruthy();
    });
  });

  describe('Basic File Metadata (Original file-description tests)', () => {
    const mockFile = {
      storageKey: { deviceId: 'test-device', storageType: StorageType.SD },
      file: {
        name: 'test-file.sid',
        path: '/music/test-file.sid',
        size: 1024,
        isFavorite: false,
        isCompatible: true,
        title: 'Test Song Title',
        creator: 'Test Artist',
        releaseInfo: '2024 Test Release',
        description: 'A test description for this file',
        shareUrl: '',
        metadataSource: 'HVSC',
        meta1: 'SID',
        meta2: '6581',
        metadataSourcePath: '',
        parentPath: '/music',
        playLength: '3:00',
        subtuneLengths: [],
        startSubtuneNum: 0,
        images: [],
        type: FileItemType.Song,
        links: [],
        tags: [],
        youTubeVideos: [],
        competitions: [],
        ratingCount: 0,
      },
      parentPath: '/music',
      launchedAt: Date.now(),
      isCompatible: true,
    };

    it('should expose displayTitle with title when available', () => {
      currentFileSignal.set(mockFile);
      fixture.detectChanges();

      expect(component.displayTitle()).toBe('Test Song Title');
    });

    it('should expose creator signal', () => {
      currentFileSignal.set(mockFile);
      fixture.detectChanges();

      expect(component.creator()).toBe('Test Artist');
    });

    it('should pass title and subtitle to scaling-card', () => {
      currentFileSignal.set(mockFile);
      fixture.detectChanges();

      const scalingCard = fixture.debugElement.query(By.css('lib-scaling-card'));
      expect(scalingCard.componentInstance.title()).toBe('Test Song Title');
      expect(scalingCard.componentInstance.subtitle()).toBe('Test Artist');
    });

    it('should display description', () => {
      currentFileSignal.set(mockFile);
      fixture.detectChanges();

      const descEl = fixture.debugElement.query(By.css('.description-text'));
      expect(descEl.nativeElement.textContent.trim()).toBe('A test description for this file');
    });

    it('should show HVSC STIL label for songs', () => {
      currentFileSignal.set(mockFile);
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('.section-label'));
      expect(label.nativeElement.textContent.trim()).toBe('HVSC STIL');
    });

    it('should fall back to filename when no title', () => {
      const noTitleFile = {
        ...mockFile,
        file: { ...mockFile.file, title: '' },
      };
      currentFileSignal.set(noTitleFile);
      fixture.detectChanges();

      expect(component.displayTitle()).toBe('test-file.sid');
    });

    it('should display release info when available', () => {
      currentFileSignal.set(mockFile);
      fixture.detectChanges();

      const releaseEl = fixture.debugElement.query(By.css('.release-info'));
      expect(releaseEl.nativeElement.textContent.trim()).toBe('2024 Test Release');
    });
  });

  describe('Meta Chips Display', () => {
    it('should display meta1 chip when present', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.prg',
          path: '/test/test.prg',
          type: FileItemType.Game,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: '',
          meta1: 'PRG',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/test',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.meta1()).toBe('PRG');
      const chips = fixture.debugElement.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(1);
      expect(chips[0].nativeElement.textContent.trim()).toBe('PRG');
    });

    it('should display meta2 chip when present', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.prg',
          path: '/test/test.prg',
          type: FileItemType.Game,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: '',
          meta1: '',
          meta2: 'C64',
          metadataSourcePath: '',
          parentPath: '/test',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.meta2()).toBe('C64');
      const chips = fixture.debugElement.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(1);
      expect(chips[0].nativeElement.textContent.trim()).toBe('C64');
    });

    it('should display both chips when meta1 and meta2 are present', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.prg',
          path: '/test/test.prg',
          type: FileItemType.Game,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: '',
          meta1: 'PRG',
          meta2: 'C64',
          metadataSourcePath: '',
          parentPath: '/test',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      const chips = fixture.debugElement.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(2);
      expect(chips[0].nativeElement.textContent.trim()).toBe('PRG');
      expect(chips[1].nativeElement.textContent.trim()).toBe('C64');
    });

    it('should not display chip-set when meta1 and meta2 are empty', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.prg',
          path: '/test/test.prg',
          type: FileItemType.Game,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: '',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/test',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      const chipSet = fixture.debugElement.query(By.css('mat-chip-set'));
      expect(chipSet).toBeNull();
    });
  });

  describe('DeepSID Metadata - Links', () => {
    it('should display links section when links exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: 'Test Artist',
          releaseInfo: '2024',
          description: 'A test song',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [
            { name: 'CSDb', url: 'https://csdb.dk/release/?id=12345' },
            { name: 'Pouët', url: 'https://pouet.net/prod.php?which=12345' },
          ],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.links().length).toBe(2);

      const linksSection = fixture.debugElement.query(By.css('.links-section'));
      expect(linksSection).toBeTruthy();

      const heading = linksSection.query(By.css('h4'));
      expect(heading.nativeElement.textContent).toBe('Links');

      const links = linksSection.queryAll(By.css('lib-external-link'));
      expect(links.length).toBe(2);
      expect(links[0].nativeElement.textContent.trim()).toContain('CSDb');
      expect(links[1].nativeElement.textContent.trim()).toContain('Pouët');
    });

    it('should not display links section when no links exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'A test song',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.links().length).toBe(0);
      const linksSection = fixture.debugElement.query(By.css('.links-section'));
      expect(linksSection).toBeNull();
    });
  });

  describe('DeepSID Metadata - YouTube Videos', () => {
    it('should display YouTube videos section when videos exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [
            {
              videoId: 'abc123',
              url: 'https://youtube.com/watch?v=abc123',
              channel: 'C64 Music Channel',
              subtune: 0,
            },
            {
              videoId: 'def456',
              url: 'https://youtube.com/watch?v=def456',
              channel: 'Retro Gaming',
              subtune: 2,
            },
          ],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.youTubeVideos().length).toBe(2);

      const videosSection = fixture.debugElement.query(By.css('.youtube-section'));
      expect(videosSection).toBeTruthy();

      const heading = videosSection.query(By.css('h4'));
      expect(heading.nativeElement.textContent).toBe('Related Videos');

      const videos = videosSection.queryAll(By.css('lib-action-link'));
      expect(videos.length).toBe(2);
      expect(videos[0].nativeElement.textContent.trim()).toContain('C64 Music Channel');
      expect(videos[1].nativeElement.textContent.trim()).toContain('Retro Gaming');
    });

    it('should not display YouTube section when no videos exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.youTubeVideos().length).toBe(0);
      const videosSection = fixture.debugElement.query(By.css('.youtube-section'));
      expect(videosSection).toBeNull();
    });
  });

  describe('DeepSID Metadata - Competitions', () => {
    it('should display competitions section when competitions exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [{ name: 'X Party 2024', place: 1 }, { name: 'Demo Scene Awards' }],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.competitions().length).toBe(2);

      const competitionsSection = fixture.debugElement.query(By.css('.competitions-section'));
      expect(competitionsSection).toBeTruthy();

      const heading = competitionsSection.query(By.css('h4'));
      expect(heading.nativeElement.textContent).toBe('Competition Results');

      const items = competitionsSection.queryAll(By.css('.competition-item'));
      expect(items.length).toBe(2);
      expect(items[0].nativeElement.textContent.trim()).toContain('X Party 2024');
      expect(items[0].nativeElement.textContent.trim()).toContain('Place 1');
    });

    it('should display competition without place when place is undefined', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [{ name: 'Demo Scene Awards' }],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      const competitionItem = fixture.debugElement.query(By.css('.competition-item'));
      expect(competitionItem.nativeElement.textContent.trim()).toBe('Demo Scene Awards');

      const position = competitionItem.query(By.css('.position'));
      expect(position).toBeNull();
    });

    it('should not display competitions section when no competitions exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.competitions().length).toBe(0);
      const competitionsSection = fixture.debugElement.query(By.css('.competitions-section'));
      expect(competitionsSection).toBeNull();
    });
  });

  describe('DeepSID Metadata - Tags', () => {
    it('should display tags section when tags exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [
            { name: 'Chiptune', type: 'genre' },
            { name: 'Classic', type: 'era' },
          ],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.tags().length).toBe(2);

      const tagsSection = fixture.debugElement.query(By.css('.tags-section'));
      expect(tagsSection).toBeTruthy();

      const heading = tagsSection.query(By.css('h4'));
      expect(heading.nativeElement.textContent).toBe('Tags');

      const chipSet = tagsSection.query(By.css('mat-chip-set'));
      expect(chipSet).toBeTruthy();

      const chips = chipSet.queryAll(By.css('mat-chip'));
      expect(chips.length).toBe(2);
      expect(chips[0].nativeElement.textContent.trim()).toBe('Chiptune');
      expect(chips[0].nativeElement.classList.contains('tag-genre')).toBe(true);
      expect(chips[1].nativeElement.textContent.trim()).toBe('Classic');
      expect(chips[1].nativeElement.classList.contains('tag-era')).toBe(true);
    });

    it('should not display tags section when no tags exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.tags().length).toBe(0);
      const tagsSection = fixture.debugElement.query(By.css('.tags-section'));
      expect(tagsSection).toBeNull();
    });
  });

  describe('DeepSID Metadata - Ratings', () => {
    it('should display rating section when avgRating exists', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          avgRating: 4.5,
          ratingCount: 42,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.avgRating()).toBe(4.5);
      expect(component.ratingCount()).toBe(42);

      const ratingSection = fixture.debugElement.query(By.css('.rating-section'));
      expect(ratingSection).toBeTruthy();
      expect(ratingSection.nativeElement.textContent).toContain('4.5/5.0');
      expect(ratingSection.nativeElement.textContent).toContain('(42 ratings)');
    });

    it('should not display rating section when avgRating is undefined', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.avgRating()).toBeUndefined();
      const ratingSection = fixture.debugElement.query(By.css('.rating-section'));
      expect(ratingSection).toBeNull();
    });
  });

  describe('hasContent and hasExtendedContent Computed Signals', () => {
    it('hasContent should return true when title exists', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: '',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.hasContent()).toBe(true);
    });

    it('hasContent should return true when links exist', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: '',
          creator: '',
          releaseInfo: '',
          description: '',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [{ name: 'Link', url: 'http://example.com' }],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.hasContent()).toBe(true);
      expect(component.hasExtendedContent()).toBe(true);
    });

    it('hasExtendedContent should return true when avgRating exists', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: '',
          creator: '',
          releaseInfo: '',
          description: '',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [],
          tags: [],
          youTubeVideos: [],
          competitions: [],
          avgRating: 3.5,
          ratingCount: 10,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.hasExtendedContent()).toBe(true);
    });
  });

  describe('Metadata Grid Layout', () => {
    it('should display all sections in metadata grid when data is available', () => {
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: {
          name: 'test.sid',
          path: '/music/test.sid',
          type: FileItemType.Song,
          size: 1024,
          isFavorite: false,
          isCompatible: true,
          title: 'Test Song',
          creator: '',
          releaseInfo: '',
          description: 'Test',
          shareUrl: '',
          metadataSource: 'DeepSID',
          meta1: '',
          meta2: '',
          metadataSourcePath: '',
          parentPath: '/music',
          playLength: '',
          subtuneLengths: [],
          startSubtuneNum: 0,
          images: [],
          links: [{ name: 'Link', url: 'http://example.com' }],
          tags: [{ name: 'Tag', type: 'genre' }],
          youTubeVideos: [
            { videoId: 'abc', url: 'http://youtube.com', channel: 'Channel', subtune: 0 },
          ],
          competitions: [{ name: 'Competition', place: 1 }],
          ratingCount: 0,
        },
        isShuffleMode: false,
      });
      fixture.detectChanges();

      const linksSection = fixture.debugElement.query(By.css('.links-section'));
      const videosSection = fixture.debugElement.query(By.css('.youtube-section'));
      const competitionsSection = fixture.debugElement.query(By.css('.competitions-section'));
      const tagsSection = fixture.debugElement.query(By.css('.tags-section'));

      expect(linksSection).toBeTruthy();
      expect(videosSection).toBeTruthy();
      expect(competitionsSection).toBeTruthy();
      expect(tagsSection).toBeTruthy();
    });
  });
});

