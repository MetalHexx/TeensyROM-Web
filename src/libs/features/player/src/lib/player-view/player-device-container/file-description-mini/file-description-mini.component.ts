import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT } from '@teensyrom-nx/application';

@Component({
  selector: 'lib-file-description-mini',
  imports: [
    CommonModule,
    ScalingCardComponent,
    MatIconModule,
  ],
  templateUrl: './file-description-mini.component.html',
  styleUrl: './file-description-mini.component.scss',
})
export class FileDescriptionMiniComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);

  deviceId = input.required<string>();

  private readonly currentFile = computed(() =>
    this.playerContext.getCurrentFile(this.deviceId())()
  );

  readonly hasFile = computed(() => !!this.currentFile());
  readonly creator = computed(() => this.currentFile()?.file.creator ?? '');
  readonly title = computed(() => this.currentFile()?.file.title ?? '');
  readonly filename = computed(() => this.currentFile()?.file.name ?? '');

  readonly displayTitle = computed(() => this.title() || this.filename());
}
