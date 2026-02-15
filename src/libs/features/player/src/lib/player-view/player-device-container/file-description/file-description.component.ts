import { Component, input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import {
  ScalingCardComponent,
  ExternalLinkComponent,
  ActionLinkComponent,
} from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT } from '@teensyrom-nx/application';
import { FileItemType, YouTubeVideo } from '@teensyrom-nx/domain';
import { YouTubeDialogComponent } from './youtube-dialog/youtube-dialog.component';

@Component({
  selector: 'lib-file-description',
  imports: [
    CommonModule,
    ScalingCardComponent,
    MatIconModule,
    MatChipsModule,
    ExternalLinkComponent,
    ActionLinkComponent,
  ],
  templateUrl: './file-description.component.html',
  styleUrl: './file-description.component.scss',
})
export class FileDescriptionComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);
  private readonly dialog = inject(MatDialog);

  deviceId = input.required<string>();

  private readonly currentFile = computed(() =>
    this.playerContext.getCurrentFile(this.deviceId())()
  );

  readonly hasFile = computed(() => !!this.currentFile());
  readonly creator = computed(() => this.currentFile()?.file.creator ?? '');
  readonly title = computed(() => this.currentFile()?.file.title ?? '');
  readonly filename = computed(() => this.currentFile()?.file.name ?? '');
  readonly description = computed(() => this.currentFile()?.file.description ?? '');
  readonly releaseInfo = computed(() => this.currentFile()?.file.releaseInfo ?? '');
  readonly fileType = computed(() => this.currentFile()?.file.type);
  readonly isSong = computed(() => this.fileType() === FileItemType.Song);

  readonly displayTitle = computed(() => this.title() || this.filename());

  // Meta chips
  readonly meta1 = computed(() => this.currentFile()?.file.meta1 ?? '');
  readonly meta2 = computed(() => this.currentFile()?.file.meta2 ?? '');

  // DeepSID metadata computed signals
  readonly links = computed(() => this.currentFile()?.file.links ?? []);
  readonly tags = computed(() => this.currentFile()?.file.tags ?? []);
  readonly youTubeVideos = computed(() => this.currentFile()?.file.youTubeVideos ?? []);
  readonly competitions = computed(() => this.currentFile()?.file.competitions ?? []);
  readonly avgRating = computed(() => this.currentFile()?.file.avgRating);
  readonly ratingCount = computed(() => this.currentFile()?.file.ratingCount ?? 0);

  readonly hasExtendedContent = computed(() => {
    const file = this.currentFile();
    return !!(
      file?.file.creator ||
      file?.file.meta1 ||
      file?.file.meta2 ||
      file?.file.releaseInfo ||
      file?.file.links?.length ||
      file?.file.tags?.length ||
      file?.file.youTubeVideos?.length ||
      file?.file.competitions?.length ||
      file?.file.avgRating
    );
  });

  readonly hasContent = computed(() => {
    const file = this.currentFile();
    return !!(
      file?.file.title ||
      file?.file.meta1 ||
      file?.file.meta2 ||
      file?.file.description ||
      file?.file.links?.length ||
      file?.file.tags?.length ||
      file?.file.youTubeVideos?.length ||
      file?.file.competitions?.length ||
      file?.file.avgRating
    );
  });

  openYouTubeDialog(video: YouTubeVideo): void {
    this.dialog.open(YouTubeDialogComponent, {
      data: { video },
      width: '800px',
      maxWidth: '90vw',
      panelClass: 'youtube-dialog',
      backdropClass: 'youtube-dialog-backdrop',
    });
  }
}
