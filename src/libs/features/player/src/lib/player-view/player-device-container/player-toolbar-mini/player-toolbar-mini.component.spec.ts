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
import { PlayerToolbarMiniComponent } from './player-toolbar-mini.component';

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
  const currentFile = signal<LaunchedFile | null>(null);
  const playerStatus = signal<PlayerStatus>(PlayerStatus.Stopped);
  const fileContext = signal<PlayerFileContext | null>(null);
  const launchMode = signal<LaunchMode>(LaunchMode.Directory);
  const audioStreamEnabled = signal(false);

  const context = {
    getCurrentFile: vi.fn().mockReturnValue(currentFile),
    getPlayerStatus: vi.fn().mockReturnValue(playerStatus),
    getFileContext: vi.fn().mockReturnValue(fileContext),
    getLaunchMode: vi.fn().mockReturnValue(launchMode),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    previous: vi.fn().mockResolvedValue(undefined),
  };

  const settingsStore = {
    enableAudioStreamForDevice: vi.fn().mockReturnValue(audioStreamEnabled),
  };

  const result = renderPlayerComponent(PlayerToolbarMiniComponent, {
    inputs: { deviceId },
    playerContext: context,
    providers: [{ provide: SettingsStore, useValue: settingsStore }],
  });

  return {
    ...result,
    context,
    settingsStore,
    currentFile,
    playerStatus,
    fileContext,
    launchMode,
    audioStreamEnabled,
  };
}

/** The three playback icon-buttons in template order: previous, play/pause-or-stop, next. */
function playbackButtons(fixture: ComponentFixture<PlayerToolbarMiniComponent>): DebugElement[] {
  const controls = fixture.debugElement.query(By.css('.playback-controls'));
  return controls.queryAll(By.css('lib-icon-button'));
}

function prop(el: DebugElement, name: string): unknown {
  return (el.nativeElement as Record<string, unknown>)[name];
}

describe('PlayerToolbarMiniComponent', () => {
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
  });

  describe('previous()', () => {
    it("calls the context's previous with the deviceId", async () => {
      const { component, context } = render();

      await component.previous();

      expect(context.previous).toHaveBeenCalledWith('test-device-id');
    });
  });

  describe('UI state computeds', () => {
    it('icon is play_arrow when stopped', () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Stopped);

      expect(component.getPlayPauseIconComputed()).toBe('play_arrow');
    });

    it('icon is pause when playing', () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Playing);

      expect(component.getPlayPauseIconComputed()).toBe('pause');
    });

    it("label is 'Play' when stopped", () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Stopped);

      expect(component.getPlayPauseLabelComputed()).toBe('Play');
    });

    it("label is 'Pause' when playing", () => {
      const { component, playerStatus } = render();
      playerStatus.set(PlayerStatus.Playing);

      expect(component.getPlayPauseLabelComputed()).toBe('Pause');
    });

    it('detects a music-type current file', () => {
      const { component, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Song));

      expect(component.isCurrentFileMusicTypeComputed()).toBe(true);
    });

    it('detects a non-music-type current file', () => {
      const { component, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Game));

      expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
    });

    it('isPlayerLoaded is true when a current file exists', () => {
      const { component, currentFile } = render();
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Song));

      expect(component.isPlayerLoadedComputed()).toBe(true);
    });

    it("isPlayerLoaded is false when there's no current file", () => {
      const { component } = render();

      expect(component.isPlayerLoadedComputed()).toBe(false);
    });
  });

  describe('canNavigateComputed()', () => {
    it('allows navigation with multiple files in context', () => {
      const { component, fileContext } = render();
      fileContext.set({
        storageKey: StorageKeyUtil.create('test-device-id', StorageType.Sd),
        directoryPath: '/test',
        files: [createTestFileItem(), createTestFileItem()],
        currentIndex: 0,
      });

      expect(component.canNavigateComputed()).toBe(true);
    });

    it('allows navigation in shuffle mode regardless of file count', () => {
      const { component, fileContext, launchMode } = render();
      fileContext.set({
        storageKey: StorageKeyUtil.create('test-device-id', StorageType.Sd),
        directoryPath: '/test',
        files: [createTestFileItem()],
        currentIndex: 0,
      });
      launchMode.set(LaunchMode.Shuffle);

      expect(component.canNavigateComputed()).toBe(true);
    });

    it('disallows navigation with a single file in directory mode', () => {
      const { component, fileContext, launchMode } = render();
      fileContext.set({
        storageKey: StorageKeyUtil.create('test-device-id', StorageType.Sd),
        directoryPath: '/test',
        files: [createTestFileItem()],
        currentIndex: 0,
      });
      launchMode.set(LaunchMode.Directory);

      expect(component.canNavigateComputed()).toBe(false);
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
      currentFile.set(createLaunchedFile('test-device-id', FileItemType.Game));
      setInput('disabled', true);
      fixture.detectChanges();

      const [previous, stopButton, next] = playbackButtons(fixture);

      expect(prop(previous, 'disabled')).toBe(true);
      expect(prop(stopButton, 'disabled')).toBe(true);
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

      const [previous, playPause, next] = playbackButtons(fixture);

      expect(prop(previous, 'disabled')).toBe(false);
      expect(prop(playPause, 'disabled')).toBe(false);
      expect(prop(next, 'disabled')).toBe(false);
    });
  });

  describe('volume popup integration', () => {
    it('renders when audio streaming is enabled for the device', () => {
      const { fixture, audioStreamEnabled } = render();
      audioStreamEnabled.set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-volume-popup')).toBeTruthy();
    });

    it('is absent when audio streaming is disabled', () => {
      const { fixture } = render();

      expect(fixture.nativeElement.querySelector('lib-volume-popup')).toBeNull();
    });

    it("receives disabled=true matching the toolbar's disabled state", () => {
      const { fixture, audioStreamEnabled, setInput } = render();
      audioStreamEnabled.set(true);
      setInput('disabled', true);
      fixture.detectChanges();

      const volumePopup = fixture.debugElement.query(By.css('lib-volume-popup'));

      expect(prop(volumePopup, 'disabled')).toBe(true);
    });

    it('receives disabled=false when the toolbar is enabled', () => {
      const { fixture, audioStreamEnabled, setInput } = render();
      audioStreamEnabled.set(true);
      setInput('disabled', false);
      fixture.detectChanges();

      const volumePopup = fixture.debugElement.query(By.css('lib-volume-popup'));

      expect(prop(volumePopup, 'disabled')).toBe(false);
    });

    it('renders inside the playback-controls container', () => {
      const { fixture, audioStreamEnabled } = render();
      audioStreamEnabled.set(true);
      fixture.detectChanges();

      const playbackControls = fixture.nativeElement.querySelector('.playback-controls');

      expect(playbackControls).toBeTruthy();
      expect(playbackControls.querySelector('lib-volume-popup')).toBeTruthy();
    });
  });
});
