import { signal } from '@angular/core';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import type { IPlayerContext } from '@teensyrom-nx/application';
import { createMockStorageService } from '@teensyrom-nx/testing/fixtures';
import { STORAGE_SERVICE, PlayerFilterType } from '@teensyrom-nx/domain';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { FilterToolbarComponent } from './filter-toolbar.component';

const deviceId = 'device-1';

const SELECTORS = {
  filterAllButton: '[data-testid="filter-all-button"]',
  filterGamesButton: '[data-testid="filter-games-button"]',
  filterMusicButton: '[data-testid="filter-music-button"]',
  filterImagesButton: '[data-testid="filter-images-button"]',
  randomLaunchButton: '[data-testid="random-launch-button"]',
} as const;

describe('FilterToolbarComponent', () => {
  // The button-color, aria-label, and click-forwarding assertions all reach into the real
  // lib-icon-button / lib-random-roll-button children, so this component renders its real tree.
  function render(inputs: Record<string, unknown> = {}, playerContext: Partial<IPlayerContext> = {}) {
    return renderPlayerComponent(FilterToolbarComponent, {
      inputs: { deviceId, ...inputs },
      playerContext,
      providers: [{ provide: STORAGE_SERVICE, useValue: createMockStorageService() }],
      stubChildren: false,
    });
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  it('reflects the deviceId input', () => {
    const { component } = render();
    expect(component.deviceId()).toBe(deviceId);
  });

  describe('filter actions', () => {
    it('sets the filter to All on onAllClick', () => {
      const setFilterMode = vi.fn();
      const { component } = render({}, { setFilterMode });
      component.onAllClick();
      expect(setFilterMode).toHaveBeenCalledWith(deviceId, PlayerFilterType.All);
    });

    it('sets the filter to Games on onGamesClick', () => {
      const setFilterMode = vi.fn();
      const { component } = render({}, { setFilterMode });
      component.onGamesClick();
      expect(setFilterMode).toHaveBeenCalledWith(deviceId, PlayerFilterType.Games);
    });

    it('sets the filter to Music on onMusicClick', () => {
      const setFilterMode = vi.fn();
      const { component } = render({}, { setFilterMode });
      component.onMusicClick();
      expect(setFilterMode).toHaveBeenCalledWith(deviceId, PlayerFilterType.Music);
    });

    it('sets the filter to Images on onImagesClick', () => {
      const setFilterMode = vi.fn();
      const { component } = render({}, { setFilterMode });
      component.onImagesClick();
      expect(setFilterMode).toHaveBeenCalledWith(deviceId, PlayerFilterType.Images);
    });
  });

  describe('active filter display', () => {
    it.each([
      [PlayerFilterType.All],
      [PlayerFilterType.Games],
      [PlayerFilterType.Music],
      [PlayerFilterType.Images],
    ])('highlights %s when it is the active filter', (filter) => {
      const { component } = render(
        {},
        { getShuffleSettings: vi.fn().mockReturnValue(signal({ filter }).asReadonly()) }
      );
      expect(component.getButtonColor(filter)).toBe('highlight');
    });

    it('reports normal for inactive filters', () => {
      const { component } = render(
        {},
        {
          getShuffleSettings: vi
            .fn()
            .mockReturnValue(signal({ filter: PlayerFilterType.Music }).asReadonly()),
        }
      );
      expect(component.getButtonColor(PlayerFilterType.All)).toBe('normal');
      expect(component.getButtonColor(PlayerFilterType.Games)).toBe('normal');
      expect(component.getButtonColor(PlayerFilterType.Images)).toBe('normal');
    });
  });

  describe('error state', () => {
    it('keeps the active filter highlighted when an error exists', () => {
      const { component } = render(
        {},
        {
          getShuffleSettings: vi
            .fn()
            .mockReturnValue(signal({ filter: PlayerFilterType.Music }).asReadonly()),
          getError: vi.fn().mockReturnValue(signal('Random launch failed').asReadonly()),
        }
      );

      expect(component.getButtonColor(PlayerFilterType.Music)).toBe('highlight');
      expect(component.getButtonColor(PlayerFilterType.All)).toBe('normal');
    });

    it('shows the random roll button as normal regardless of error state', () => {
      const { fixture } = render(
        {},
        { getError: vi.fn().mockReturnValue(signal('Random launch failed').asReadonly()) }
      );
      const randomButton = fixture.debugElement.query(By.css('lib-random-roll-button'));
      expect(randomButton.componentInstance.getButtonColor()).toBe('normal');
    });
  });

  describe('random launch', () => {
    it('launches a random file for the device', async () => {
      const launchRandomFile = vi.fn().mockResolvedValue(undefined);
      const { component } = render({}, { launchRandomFile });

      await component.onRandomLaunchClick();

      expect(launchRandomFile).toHaveBeenCalledWith(deviceId);
    });

    it('is a no-op with an empty deviceId', async () => {
      const launchRandomFile = vi.fn().mockResolvedValue(undefined);
      const { component } = render({ deviceId: '' }, { launchRandomFile });

      await component.onRandomLaunchClick();

      expect(launchRandomFile).not.toHaveBeenCalled();
    });

    it('catches and logs a rejected random launch', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const launchRandomFile = vi.fn().mockRejectedValue(new Error('launch failed'));
      const { component } = render({}, { launchRandomFile });

      await expect(component.onRandomLaunchClick()).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('rendering', () => {
    it('renders all 4 filter buttons', () => {
      const { fixture } = render();
      expect(fixture.debugElement.query(By.css(SELECTORS.filterAllButton))).toBeTruthy();
      expect(fixture.debugElement.query(By.css(SELECTORS.filterGamesButton))).toBeTruthy();
      expect(fixture.debugElement.query(By.css(SELECTORS.filterMusicButton))).toBeTruthy();
      expect(fixture.debugElement.query(By.css(SELECTORS.filterImagesButton))).toBeTruthy();
    });

    it('renders the vertical separator', () => {
      const { fixture } = render();
      const separator = fixture.nativeElement.querySelector('.vertical-separator');
      expect(separator).toBeTruthy();
    });

    it('renders a joystick icon inside the Games button', () => {
      const { fixture } = render();
      const gamesButton = fixture.debugElement.query(By.css(SELECTORS.filterGamesButton));
      expect(gamesButton.query(By.css('lib-joystick-icon'))).toBeTruthy();
    });

    it('renders an image icon inside the Images button', () => {
      const { fixture } = render();
      const imagesButton = fixture.debugElement.query(By.css(SELECTORS.filterImagesButton));
      expect(imagesButton.query(By.css('lib-image-icon'))).toBeTruthy();
    });

    it('wraps content in a compact card layout', () => {
      const { fixture } = render();
      expect(fixture.nativeElement.querySelector('lib-compact-card-layout')).toBeTruthy();
    });

    it('renders buttons in order, with the separator between the filters and the random button', () => {
      const { fixture } = render();
      const buttons = fixture.debugElement.queryAll(By.css('lib-icon-button'));
      expect(buttons).toHaveLength(5);

      const separator = fixture.nativeElement.querySelector('.vertical-separator');
      const randomButton = fixture.debugElement.query(By.css(SELECTORS.randomLaunchButton))
        .nativeElement;
      expect(separator.nextElementSibling).toBe(randomButton);
    });

    it('carries the correct accessibility aria-label on every button', () => {
      const expectedLabels: Record<string, string> = {
        [SELECTORS.filterAllButton]:
          'Filter: Allow All Files.  Random launches and search will include all file types.',
        [SELECTORS.filterGamesButton]:
          'Filter Games/Programs Only.  Random launches and search will only include games and programs.',
        [SELECTORS.filterMusicButton]:
          'Filter: Music Only. Random launches and search will only include music files.',
        [SELECTORS.filterImagesButton]:
          'Filter: Images / Text files Only. Random launches and search will only include image and text files.',
        [SELECTORS.randomLaunchButton]:
          'Launch a random file.  Will only launch files matching the current filter.',
      };
      const { fixture } = render();

      for (const [selector, expectedLabel] of Object.entries(expectedLabels)) {
        const button = fixture.debugElement.query(By.css(selector));
        const innerButton = button.query(By.css('button'));
        expect(innerButton.nativeElement.getAttribute('aria-label')).toBe(expectedLabel);
      }
    });

    it('uses the large size on every button for touch targets', () => {
      const { fixture } = render();
      const buttons = fixture.debugElement.queryAll(By.css('lib-icon-button'));
      buttons.forEach((button) => {
        expect(button.nativeElement.getAttribute('size')).toBe('large');
      });
    });
  });

  describe('user interactions', () => {
    it.each([
      [SELECTORS.filterAllButton, 'onAllClick'],
      [SELECTORS.filterGamesButton, 'onGamesClick'],
      [SELECTORS.filterMusicButton, 'onMusicClick'],
      [SELECTORS.filterImagesButton, 'onImagesClick'],
    ] as const)('clicking %s triggers %s', (selector, methodName) => {
      const { component, fixture } = render();
      const spy = vi.spyOn(component, methodName);
      const button = fixture.debugElement.query(By.css(selector));
      button.query(By.css('button')).nativeElement.click();

      expect(spy).toHaveBeenCalled();
    });
  });

  it('does not throw when handlers are invoked with a missing deviceId', async () => {
    const { component } = render({ deviceId: undefined });

    expect(() => component.onAllClick()).not.toThrow();
    expect(() => component.onGamesClick()).not.toThrow();
    expect(() => component.onMusicClick()).not.toThrow();
    expect(() => component.onImagesClick()).not.toThrow();
    await expect(component.onRandomLaunchClick()).resolves.toBeUndefined();
  });

  // The dice-roll animation this file's `describe.skip('Dice Roll Animation', ...)` block once
  // targeted no longer lives on FilterToolbarComponent — `isDiceRolling`, `animateDiceRoll`, and
  // `randomButton` were relocated to RandomRollButtonComponent, which owns and tests that
  // behavior directly (see random-roll-button.component.spec.ts). Restoring the skip here isn't
  // possible: those members don't exist on this component anymore, so referencing them wouldn't
  // compile. Recorded in ASSERTION-INVENTORY.md rows 514-518/527 as dropped-with-reason.

  describe('disabled state', () => {
    it('defaults to false', () => {
      const { component } = render();
      expect(component.disabled()).toBe(false);
    });

    it('accepts true', () => {
      const { component } = render({ disabled: true });
      expect(component.disabled()).toBe(true);
    });

    it('adds the disabled-state class to the host when disabled', () => {
      const { fixture } = render({ disabled: true });
      expect(fixture.nativeElement.classList.contains('disabled-state')).toBe(true);
    });

    it('omits the disabled-state class when not disabled', () => {
      const { fixture } = render({ disabled: false });
      expect(fixture.nativeElement.classList.contains('disabled-state')).toBe(false);
    });

    it('disables all 4 filter buttons when disabled', () => {
      const { fixture } = render({ disabled: true });
      for (const selector of [
        SELECTORS.filterAllButton,
        SELECTORS.filterGamesButton,
        SELECTORS.filterMusicButton,
        SELECTORS.filterImagesButton,
      ]) {
        const button = fixture.debugElement.query(By.css(selector));
        expect(button.componentInstance.disabled()).toBe(true);
      }
    });

    it('disables the random/dice button when disabled', () => {
      const { fixture } = render({ disabled: true });
      const randomButton = fixture.debugElement.query(By.css(SELECTORS.randomLaunchButton));
      expect(randomButton.componentInstance.disabled()).toBe(true);
    });

    it('does not call setFilterMode when disabled and a handler is invoked directly', () => {
      const setFilterMode = vi.fn();
      const { component } = render({ disabled: true }, { setFilterMode });

      component.onAllClick();
      component.onGamesClick();
      component.onMusicClick();
      component.onImagesClick();

      expect(setFilterMode).not.toHaveBeenCalled();
    });

    it('does not call launchRandomFile when disabled and the handler is invoked directly', async () => {
      const launchRandomFile = vi.fn().mockResolvedValue(undefined);
      const { component } = render({ disabled: true }, { launchRandomFile });

      await component.onRandomLaunchClick();

      expect(launchRandomFile).not.toHaveBeenCalled();
    });

    it('enables all buttons when disabled is false', () => {
      const { fixture } = render({ disabled: false });
      for (const selector of [
        SELECTORS.filterAllButton,
        SELECTORS.filterGamesButton,
        SELECTORS.filterMusicButton,
        SELECTORS.filterImagesButton,
      ]) {
        const button = fixture.debugElement.query(By.css(selector));
        expect(button.componentInstance.disabled()).toBe(false);
      }
    });
  });
});
