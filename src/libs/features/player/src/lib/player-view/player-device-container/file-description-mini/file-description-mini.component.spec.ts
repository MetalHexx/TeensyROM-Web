import { signal } from '@angular/core';
import { vi } from 'vitest';
import { renderPlayerComponent } from '../../../../testing/render-player-component';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { StorageKeyUtil, type LaunchedFile } from '@teensyrom-nx/application';
import { FileItemType, StorageType } from '@teensyrom-nx/domain';
import { FileDescriptionMiniComponent } from './file-description-mini.component';

function createLaunchedFile(overrides: Parameters<typeof createTestFileItem>[0] = {}): LaunchedFile {
  return {
    storageKey: StorageKeyUtil.create('test-device-id', StorageType.Sd),
    file: createTestFileItem(overrides),
    parentPath: '/music',
    launchedAt: Date.now(),
    isCompatible: true,
  };
}

function render(currentFile: LaunchedFile | null) {
  return renderPlayerComponent(FileDescriptionMiniComponent, {
    inputs: { deviceId: 'test-device-id' },
    playerContext: {
      getCurrentFile: vi.fn().mockReturnValue(signal(currentFile).asReadonly()),
    },
  });
}

describe('FileDescriptionMiniComponent', () => {
  it('creates', () => {
    const { component } = render(createLaunchedFile());

    expect(component).toBeTruthy();
  });

  it('exposes the current file title as displayTitle', () => {
    const { component } = render(
      createLaunchedFile({ title: 'Test Song', type: FileItemType.Song })
    );

    expect(component.displayTitle()).toBe('Test Song');
  });

  it('exposes the current file creator', () => {
    const { component } = render(createLaunchedFile({ creator: 'Test Composer' }));

    expect(component.creator()).toBe('Test Composer');
  });

  it('reports hasFile as false with no current file', () => {
    const { component } = render(null);

    expect(component.hasFile()).toBe(false);
  });
});
