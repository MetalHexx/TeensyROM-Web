import { vi } from 'vitest';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { YouTubeVideo } from '@teensyrom-nx/domain';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { YouTubeDialogComponent } from './youtube-dialog.component';

const mockVideo: YouTubeVideo = {
  videoId: 'dQw4w9WgXcQ',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  channel: 'Test Channel',
  subtune: 0,
};

function render() {
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<YouTubeDialogComponent>;

  const result = renderPlayerComponent(YouTubeDialogComponent, {
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { video: mockVideo } },
    ],
  });

  return { ...result, dialogRef };
}

describe('YouTubeDialogComponent', () => {
  it('creates', () => {
    const { component } = render();

    expect(component).toBeTruthy();
  });

  it('constructs the embed URL from the video id', () => {
    const { component } = render();

    expect(component.youtubeEmbedUrl).toBeTruthy();
  });

  it('renders the iframe with the constructed embed URL', () => {
    const { fixture } = render();

    const iframe = fixture.nativeElement.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain(`youtube.com/embed/${mockVideo.videoId}`);
  });

  it('closes the dialog when onClose is called', () => {
    const { component, dialogRef } = render();

    component.onClose();

    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('carries required security/functionality attributes on the iframe', () => {
    const { fixture } = render();

    const iframe = fixture.nativeElement.querySelector('iframe');
    expect(iframe.getAttribute('allow')).toContain('autoplay');
    expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(iframe.getAttribute('allowfullscreen')).toBe('');
  });
});
