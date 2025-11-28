import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { VideoStreamComponent } from './video-stream.component';
import { ComponentRef } from '@angular/core';

describe('VideoStreamComponent', () => {
  let component: VideoStreamComponent;
  let fixture: ComponentFixture<VideoStreamComponent>;
  let componentRef: ComponentRef<VideoStreamComponent>;

  // Create minimal mock for testing
  const createMockStream = (): MediaStream => {
    return {
      getTracks: () => [],
      active: true,
    } as unknown as MediaStream;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoStreamComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoStreamComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create successfully with default inputs', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should show loading state when stream is null and showLoadingState is true', () => {
    componentRef.setInput('stream', null);
    componentRef.setInput('showLoadingState', true);
    fixture.detectChanges();

    const loadingOverlay = fixture.nativeElement.querySelector('.loading-overlay');
    expect(loadingOverlay).toBeTruthy();
    expect(loadingOverlay.textContent).toContain('Loading video');
  });

  it('should hide loading indicator when showLoadingState is false', () => {
    componentRef.setInput('stream', null);
    componentRef.setInput('showLoadingState', false);
    fixture.detectChanges();

    const loadingOverlay = fixture.nativeElement.querySelector('.loading-overlay');
    expect(loadingOverlay).toBeFalsy();
  });

  it('should bind stream to video element srcObject', fakeAsync(() => {
    const mockStream = createMockStream();
    fixture.detectChanges();

    const videoElement = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    // Mock play to avoid NotAllowedError in tests
    videoElement.play = vi.fn().mockResolvedValue(undefined);

    componentRef.setInput('stream', mockStream);
    fixture.detectChanges();
    tick();

    expect(videoElement.srcObject).toBe(mockStream);
  }));

  it('should apply objectFit style to video element', () => {
    componentRef.setInput('objectFit', 'cover');
    fixture.detectChanges();

    const videoElement = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    expect(videoElement.style.objectFit).toBe('cover');
  });

  it('should emit streamReady when video starts playing', () => {
    fixture.detectChanges();

    const streamReadySpy = vi.fn();
    component.streamReady.subscribe(streamReadySpy);

    const videoElement = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    videoElement.dispatchEvent(new Event('playing'));

    expect(streamReadySpy).toHaveBeenCalledTimes(1);
    expect(component.isPlaying()).toBe(true);
  });

  it('should emit streamError when video encounters an error', () => {
    fixture.detectChanges();

    const streamErrorSpy = vi.fn();
    component.streamError.subscribe(streamErrorSpy);

    const videoElement = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    const errorEvent = new ErrorEvent('error', { message: 'Video error' });
    videoElement.dispatchEvent(errorEvent);

    expect(streamErrorSpy).toHaveBeenCalledTimes(1);
    expect(component.isPlaying()).toBe(false);
  });

  it('should clear srcObject when stream input becomes null', fakeAsync(() => {
    const mockStream = createMockStream();
    fixture.detectChanges();

    const videoElement = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    videoElement.play = vi.fn().mockResolvedValue(undefined);

    // Set stream
    componentRef.setInput('stream', mockStream);
    fixture.detectChanges();
    tick();
    expect(videoElement.srcObject).toBe(mockStream);

    // Clear stream
    componentRef.setInput('stream', null);
    fixture.detectChanges();
    tick();
    expect(videoElement.srcObject).toBeNull();
  }));

  it('should have video element with autoplay, muted, and playsinline attributes', () => {
    fixture.detectChanges();

    const videoElement = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    expect(videoElement.hasAttribute('autoplay')).toBe(true);
    expect(videoElement.hasAttribute('muted')).toBe(true);
    expect(videoElement.hasAttribute('playsinline')).toBe(true);
  });

  it('should have accessibility attributes on video element', () => {
    fixture.detectChanges();

    const videoElement = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    expect(videoElement.getAttribute('aria-label')).toBe('Video stream display');
    expect(videoElement.getAttribute('role')).toBe('img');
  });

  it('should have accessibility attributes on loading overlay', () => {
    componentRef.setInput('stream', null);
    componentRef.setInput('showLoadingState', true);
    fixture.detectChanges();

    const loadingOverlay = fixture.nativeElement.querySelector('.loading-overlay');
    expect(loadingOverlay.getAttribute('aria-live')).toBe('polite');
    expect(loadingOverlay.getAttribute('aria-busy')).toBe('true');
  });
});
