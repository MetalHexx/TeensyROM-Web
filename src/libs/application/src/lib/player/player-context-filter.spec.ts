import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { LaunchMode, PlayerFilterType, PlayerScope } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';

describe('PlayerContextService - filter', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-filter';
  const randomFile = createTestFileItem({ name: 'random.sid', path: '/music/random.sid' });

  beforeEach(() => {
    harness = createPlayerHarness();
    harness.service.initializePlayer(deviceId);
  });

  describe('setFilterMode', () => {
    it('updates the shuffle settings filter', () => {
      harness.service.setFilterMode(deviceId, PlayerFilterType.Music);

      expect(harness.service.getShuffleSettings(deviceId)()?.filter).toBe(PlayerFilterType.Music);
    });

    it('keeps filter settings isolated between devices', () => {
      const device2 = 'device-filter-2';
      harness.service.initializePlayer(device2);

      harness.service.setFilterMode(deviceId, PlayerFilterType.Music);
      harness.service.setFilterMode(device2, PlayerFilterType.Images);

      expect(harness.service.getShuffleSettings(deviceId)()?.filter).toBe(PlayerFilterType.Music);
      expect(harness.service.getShuffleSettings(device2)()?.filter).toBe(PlayerFilterType.Images);
    });
  });

  describe('filter pass-through to the random-launch API', () => {
    it('forwards the active filter when launching a random file', async () => {
      harness.service.setFilterMode(deviceId, PlayerFilterType.Games);
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.launchRandomFile(deviceId);

      expect(harness.playerService.launchRandom).toHaveBeenCalledWith(
        deviceId,
        PlayerScope.Storage,
        PlayerFilterType.Games,
        undefined
      );
    });

    it('forwards the active filter when navigating next() in shuffle mode', async () => {
      harness.service.toggleShuffleMode(deviceId);
      harness.service.setFilterMode(deviceId, PlayerFilterType.Music);
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.next(deviceId);

      expect(harness.playerService.launchRandom).toHaveBeenCalledWith(
        deviceId,
        PlayerScope.Storage,
        PlayerFilterType.Music,
        undefined
      );
    });

    it('forwards the active filter when navigating previous() in shuffle mode', async () => {
      harness.service.toggleShuffleMode(deviceId);
      harness.service.setFilterMode(deviceId, PlayerFilterType.Images);
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.previous(deviceId);

      expect(harness.playerService.launchRandom).toHaveBeenCalledWith(
        deviceId,
        PlayerScope.Storage,
        PlayerFilterType.Images,
        undefined
      );
    });

    it('uses the updated filter for the next random launch after it changes mid-session', async () => {
      harness.playerService.launchRandom = vi.fn(() => of(randomFile));

      await harness.service.launchRandomFile(deviceId);
      expect(harness.playerService.launchRandom).toHaveBeenCalledWith(
        deviceId,
        PlayerScope.Storage,
        PlayerFilterType.All,
        undefined
      );

      harness.service.setFilterMode(deviceId, PlayerFilterType.Games);

      await harness.service.launchRandomFile(deviceId);
      expect(harness.playerService.launchRandom).toHaveBeenCalledWith(
        deviceId,
        PlayerScope.Storage,
        PlayerFilterType.Games,
        undefined
      );
    });
  });

  describe('filter state persistence', () => {
    it('survives a switch from Directory into Shuffle mode', () => {
      harness.service.setFilterMode(deviceId, PlayerFilterType.Music);

      harness.service.toggleShuffleMode(deviceId);

      expect(harness.service.getShuffleSettings(deviceId)()?.filter).toBe(PlayerFilterType.Music);
    });

    it('survives a Directory -> Shuffle -> Directory round trip', () => {
      harness.service.setFilterMode(deviceId, PlayerFilterType.Games);
      const originalFilter = harness.service.getShuffleSettings(deviceId)()?.filter;

      harness.service.toggleShuffleMode(deviceId);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Shuffle);

      harness.service.toggleShuffleMode(deviceId);
      expect(harness.service.getLaunchMode(deviceId)()).toBe(LaunchMode.Directory);

      const finalFilter = harness.service.getShuffleSettings(deviceId)()?.filter;
      expect(finalFilter).toBe(originalFilter);
      expect(finalFilter).toBe(PlayerFilterType.Games);
    });
  });
});
