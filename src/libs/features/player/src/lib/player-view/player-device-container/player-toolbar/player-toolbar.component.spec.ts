import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import type { DebugElement } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { renderPlayerComponent } from '../../../../testing/render-player-component';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { LaunchMode, PlayerStatus, FileItemType, StorageType } from '@teensyrom-nx/domain';
import {
  SettingsStore,
  StorageKeyUtil,
  type LaunchedFile,
  type PlayerFileContext,
} from '@teensyrom-nx/application';
import { PlayerToolbarComponent } from './player-toolbar.component';

function createLaunchedFile(
  deviceId: string,
  fileType: FileItemType,
  overrides: Parameters<typeof createTestFileItem>[0] = {}
): LaunchedFile {
  return {
    storageKey: StorageKeyUtil.create(deviceId, StorageType.Sd),
    file: createTestFileItem({ type: fileType, ...overrides }),
    parentPath: '/test',
    launchedAt: Date.now(),
    isCompatible: true,
  };
}

function render(deviceId = 'test-device-id') {
  const error = signal<string | null>(null);
  const currentFile = signal<LaunchedFile | null>(null);
  const playerStatus = signal<PlayerStatus>(PlayerStatus.Stopped);
  const fileContext = signal<PlayerFileContext | null>(null);
  const launchMode = signal<LaunchMode>(LaunchMode.Directory);
  const fileCompatible = signal(true);
  const audioStreamEnabled = signal(false);

  const context = {
    getError: vi.fn().mockReturnValue(error),
    getCurrentFile: vi.fn().mockReturnValue(currentFile),
    getPlayerStatus: vi.fn().mockReturnValue(playerStatus),
    getFileContext: vi.fn().mockReturnValue(fileContext),
    getLaunchMode: vi.fn().mockReturnValue(launchMode),
    isCurrentFileCompatible: vi.fn().mockReturnValue(fileCompatible),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    previous: vi.fn().mockResolvedValue(undefined),
  };

  const settingsStore = {
    enableAudioStreamForDevice: vi.fn().mockReturnValue(audioStreamEnabled),
  };

  const result = renderPlayerComponent(PlayerToolbarComponent, {
    inputs: { deviceId },
    playerContext: context,
    providers: [{ provide: SettingsStore, useValue: settingsStore }],
  });

  return {
    ...result,
    context,
    settingsStore,
    error,
    currentFile,
    playerStatus,
    fileContext,
    launchMode,
    fileCompatible,
    audioStreamEnabled,
  };
}

/** The desktop-layout block's own icon-buttons, in template order: previous, play/pause-or-stop, next. */
function desktopButtons(fixture: ComponentFixture<PlayerToolbarComponent>): DebugElement[] {
  const desktopLayout = fixture.debugElement.query(By.css('.desktop-layout'));
  return desktopLayout.queryAll(By.css('lib-icon-button'));
}

function prop(el: DebugElement, name: string): unknown {
  return (el.nativeElement as Record<string, unknown>)[name];
}

describe('PlayerToolbarComponent', () => {
  it('creates', () => {
    const { component } = render();

    expect(component).toBeTruthy();
  });

  describe('playPause()', () => {
    it('calls pause while playing', async () => {
      const { component, context, playerStatus } = render();
      playerStatus.set(PlayerStatus.Playing);

      await component.playPause();

      expect(context.pause).toHaveBeenCalledWith('test-device-id');
      expect(context.play).not.toHaveBeenCalled();
    });

    it('calls play while stopped', async () => {
      const { component, context, playerStatus } = render();
      playerStatus.set(PlayerStatus.Stopped);

      await component.playPause();

      expect(context.play).toHaveBeenCalledWith('test-device-id');
      expect(context.pause).not.toHaveBeenCalled();
    });

    it('calls play while paused', async () => {
      const { component, context, playerStatus } = render();
      playerStatus.set(PlayerStatus.Paused);

      await component.playPause();

      expect(context.play).toHaveBeenCalledWith('test-device-id');
      expect(context.pause).not.toHaveBeenCalled();
    });

    it('is a no-op with an empty deviceId', async () => {
      const { component, context, setInput } = render();
      setInput('deviceId', '');

      await component.playPause();

      expect(context.play).not.toHaveBeenCalled();
      expect(context.pause).not.toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it("calls the context's stop with the deviceId", async () => {
      const { component, context } = render();

      await component.stop();

      expect(context.stop).toHaveBeenCalledWith('test-device-id');
    });

    it('is a no-op with an empty deviceId', async () => {
      const { component, context, setInput } = render();
      setInput('deviceId', '');

      await component.stop();

      expect(context.stop).not.toHaveBeenCalled();
    });
  });

  describe('next()', () => {
    it("calls the context's next with the deviceId", async () => {
      const { component, context } = render();

      await component.next();

      expect(context.next).toHaveBeenCalledWith('test-device-id');
    });

    it('is a no-op with an empty deviceId', async () => {
      const { component, context, setInput } = render();
      setInput('deviceId', '');

      await component.next();

      expect(context.next).not.toHaveBeenCalled();
    });
  });

  describe('previous()', () => {
    it("calls the context's previous with the deviceId", async () => {
      const { component, context } = render();

      await component.previous();

      expect(context.previous).toHaveBeenCalledWith('test-device-id');
    });

    it('is a no-op with an empty deviceId', async () => {
      const { component, context, setInput } = render();
      setInput('deviceId', '');

      await component.previous();

      expect(context.previous).not.toHaveBeenCalled();
    });
  });

  describe('getPlayPauseIconComputed()', () => {
    it('is play_arrow when Stopped', () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Stopped);

      expect(component.getPlayPauseIconComputed()).toBe('play_arrow');
    });

    it('is play_arrow when Paused', () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Paused);

      expect(component.getPlayPauseIconComputed()).toBe('play_arrow');
    });

    it('is pause when Playing', () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Playing);

      expect(component.getPlayPauseIconComputed()).toBe('pause');
    });

    it('is play_arrow with an empty deviceId', () => {
      const { component, setInput } = render();
      setInput('deviceId', '');

      expect(component.getPlayPauseIconComputed()).toBe('play_arrow');
    });
  });

  describe('getPlayPauseLabelComputed()', () => {
    it("is 'Play' when Stopped", () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Stopped);

      expect(component.getPlayPauseLabelComputed()).toBe('Play');
    });

    it("is 'Play' when Paused", () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Paused);

      expect(component.getPlayPauseLabelComputed()).toBe('Play');
    });

    it("is 'Pause' when Playing", () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Playing);

      expect(component.getPlayPauseLabelComputed()).toBe('Pause');
    });

    it("is 'Play' with an empty deviceId", () => {
      const { component, setInput } = render();
      setInput('deviceId', '');

      expect(component.getPlayPauseLabelComputed()).toBe('Play');
    });
  });

  describe('isCurrentFileMusicTypeComputed()', () => {
    it('is true for a Song', () => {
      const { component, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Song));

      expect(component.isCurrentFileMusicTypeComputed()).toBe(true);
    });

    it('is false for a Game', () => {
      const { component, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Game));

      expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
    });

    it('is false for an Image', () => {
      const { component, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Image));

      expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
    });

    it('is false with no current file', () => {
      const { component } = render();

      expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
    });

    it('is false with an empty deviceId', () => {
      const { component, setInput } = render();
      setInput('deviceId', '');

      expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
    });
  });

  describe('canNavigateComputed()', () => {
    it('is true with multiple files in context', () => {
      const { component, fileContext } = render();
      fileContext.set({
        storageKey: StorageKeyUtil.create('test-device-id', StorageType.Sd),
        directoryPath: '/test',
        files: [createTestFileItem(), createTestFileItem()],
        currentIndex: 0,
      });

      expect(component.canNavigateComputed()).toBe(true);
    });

    it('is false with a single file in context', () => {
      const { component, fileContext } = render();
      fileContext.set({
        storageKey: StorageKeyUtil.create('test-device-id', StorageType.Sd),
        directoryPath: '/test',
        files: [createTestFileItem()],
        currentIndex: 0,
      });

      expect(component.canNavigateComputed()).toBe(false);
    });

    it('is true in shuffle mode regardless of context', () => {
      const { component, launchMode, fileContext } = render();
      launchMode.set(LaunchMode.Shuffle);
      fileContext.set(null);

      expect(component.canNavigateComputed()).toBe(true);
    });

    it('is false with no context outside shuffle mode', () => {
      const { component, launchMode, fileContext } = render();
      launchMode.set(LaunchMode.Directory);
      fileContext.set(null);

      expect(component.canNavigateComputed()).toBe(false);
    });

    it('is false with an empty deviceId', () => {
      const { component, setInput } = render();
      setInput('deviceId', '');

      expect(component.canNavigateComputed()).toBe(false);
    });
  });

  describe('getPlayerStatus()', () => {
    it("returns the context's status", () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Playing);

      expect(component.getPlayerStatus()).toBe(PlayerStatus.Playing);
    });

    it('returns Stopped with an empty deviceId', () => {
      const { component, setInput } = render();
      setInput('deviceId', '');

      expect(component.getPlayerStatus()).toBe(PlayerStatus.Stopped);
    });
  });

  describe('template playback buttons', () => {
    it('shows the play/pause button for music files', () => {
      const { fixture, component, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Song));
      fixture.detectChanges();

      const [, playPause] = desktopButtons(fixture);

      expect(playPause).toBeTruthy();
      expect(prop(playPause, 'icon')).toBe(component.getPlayPauseIconComputed());
    });

    it('shows the stop button for non-music files', () => {
      const { fixture, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Game));
      fixture.detectChanges();

      const [, stopButton] = desktopButtons(fixture);

      expect(stopButton).toBeTruthy();
      expect(stopButton.nativeElement.getAttribute('icon')).toBe('stop');
    });

    it('disables the navigation buttons when canNavigate is false', () => {
      const { fixture, fileContext, launchMode } = render();
      fileContext.set(null);
      launchMode.set(LaunchMode.Directory);
      fixture.detectChanges();

      const [previous, , next] = desktopButtons(fixture);

      expect(prop(previous, 'disabled')).toBe(true);
      expect(prop(next, 'disabled')).toBe(true);
    });

    it('enables the navigation buttons when canNavigate is true', () => {
      const { fixture, fileContext } = render();
      fileContext.set({
        storageKey: StorageKeyUtil.create('test-device-id', StorageType.Sd),
        directoryPath: '/test',
        files: [createTestFileItem(), createTestFileItem()],
        currentIndex: 0,
      });
      fixture.detectChanges();

      const [previous, , next] = desktopButtons(fixture);

      expect(prop(previous, 'disabled')).toBe(false);
      expect(prop(next, 'disabled')).toBe(false);
    });
  });

  describe('button click wiring', () => {
    it('triggers playPause() when the play/pause button is clicked', () => {
      const { fixture, component, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Song));
      fixture.detectChanges();
      const spy = vi.spyOn(component, 'playPause');

      const [, playPause] = desktopButtons(fixture);
      playPause.nativeElement.dispatchEvent(new Event('buttonClick'));

      expect(spy).toHaveBeenCalled();
    });

    it('triggers next() when the next button is clicked', () => {
      const { fixture, component } = render();
      const spy = vi.spyOn(component, 'next');

      const [, , next] = desktopButtons(fixture);
      next.nativeElement.dispatchEvent(new Event('buttonClick'));

      expect(spy).toHaveBeenCalled();
    });

    it('triggers previous() when the previous button is clicked', () => {
      const { fixture, component } = render();
      const spy = vi.spyOn(component, 'previous');

      const [previous] = desktopButtons(fixture);
      previous.nativeElement.dispatchEvent(new Event('buttonClick'));

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('getPlayButtonColorComputed()', () => {
    it('is error when the file is incompatible', () => {
      const { component, fileCompatible } = render();
      fileCompatible.set(false);

      expect(component.getPlayButtonColorComputed()).toBe('error');
    });

    it('is normal when the file is compatible', () => {
      const { component, fileCompatible } = render();
      fileCompatible.set(true);

      expect(component.getPlayButtonColorComputed()).toBe('normal');
    });

    it('is normal when no file is loaded', () => {
      const { component, currentFile } = render();
      currentFile.set(null);

      expect(component.getPlayButtonColorComputed()).toBe('normal');
    });

    it('is normal when disabled, even if the file is incompatible', () => {
      const { component, fileCompatible, setInput } = render();
      fileCompatible.set(false);
      setInput('disabled', true);

      expect(component.getPlayButtonColorComputed()).toBe('normal');
    });
  });

  describe('hasError()', () => {
    it('is true when an error is set', () => {
      const { component, error } = render();
      error.set('Test error');

      expect(component.hasError()).toBe(true);
    });

    it('is false when the error is null', () => {
      const { component, error } = render();
      error.set(null);

      expect(component.hasError()).toBe(false);
    });
  });

  describe('disabled input', () => {
    it('defaults to false', () => {
      const { component } = render();

      expect(component.disabled()).toBe(false);
    });

    it('accepts true', () => {
      const { component, setInput } = render();
      setInput('disabled', true);

      expect(component.disabled()).toBe(true);
    });

    it('adds the disabled-state class to the host when disabled', () => {
      const { fixture, setInput } = render();
      setInput('disabled', true);

      expect(fixture.nativeElement.classList.contains('disabled-state')).toBe(true);
    });

    it('does not add the disabled-state class when not disabled', () => {
      const { fixture, setInput } = render();
      setInput('disabled', false);

      expect(fixture.nativeElement.classList.contains('disabled-state')).toBe(false);
    });

    it('disables all playback buttons when disabled=true', () => {
      const { fixture, currentFile, setInput } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Song));
      setInput('disabled', true);
      fixture.detectChanges();

      const [previous, playPause, next] = desktopButtons(fixture);

      expect(prop(previous, 'disabled')).toBe(true);
      expect(prop(playPause, 'disabled')).toBe(true);
      expect(prop(next, 'disabled')).toBe(true);
    });

    it('enables playback buttons when disabled=false and navigation is possible', () => {
      const { fixture, currentFile, fileContext, setInput } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Song));
      fileContext.set({
        storageKey: StorageKeyUtil.create('test-device-id', StorageType.Sd),
        directoryPath: '/test',
        files: [createTestFileItem(), createTestFileItem()],
        currentIndex: 0,
      });
      setInput('disabled', false);
      fixture.detectChanges();

      const [previous, playPause, next] = desktopButtons(fixture);

      expect(prop(previous, 'disabled')).toBe(false);
      expect(prop(playPause, 'disabled')).toBe(false);
      expect(prop(next, 'disabled')).toBe(false);
    });
  });

  describe('volume control integration', () => {
    it('renders when audio streaming is enabled', () => {
      const { fixture, audioStreamEnabled } = render();
      audioStreamEnabled.set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('lib-volume-control').length).toBeGreaterThan(0);
    });

    it('is absent when audio streaming is disabled', () => {
      const { fixture, audioStreamEnabled } = render();
      audioStreamEnabled.set(false);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('lib-volume-control').length).toBe(0);
    });

    it("receives disabled=true matching the toolbar's disabled state", () => {
      const { fixture, audioStreamEnabled, setInput } = render();
      audioStreamEnabled.set(true);
      setInput('disabled', true);
      fixture.detectChanges();

      const volumeControl = fixture.debugElement.query(By.css('lib-volume-control'));

      expect(prop(volumeControl, 'disabled')).toBe(true);
    });

    it('receives disabled=false when the toolbar is enabled', () => {
      const { fixture, audioStreamEnabled, setInput } = render();
      audioStreamEnabled.set(true);
      setInput('disabled', false);
      fixture.detectChanges();

      const volumeControl = fixture.debugElement.query(By.css('lib-volume-control'));

      expect(prop(volumeControl, 'disabled')).toBe(false);
    });

    it('renders inside a .volume-control-section wrapper', () => {
      const { fixture, audioStreamEnabled } = render();
      audioStreamEnabled.set(true);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.volume-control-section');

      expect(wrapper).toBeTruthy();
      expect(wrapper.querySelector('lib-volume-control')).toBeTruthy();
    });
  });
});
