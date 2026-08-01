import { TestBed } from '@angular/core/testing';
import { AudioStore } from './audio-store';
import {
  AUDIO_STREAM_SERVICE,
  IAudioStreamService,
  AudioDevice,
  AudioStreamState,
} from '@teensyrom-nx/domain';
import { of } from 'rxjs';

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Creates a mock audio device for testing
 */
const createMockAudioDevice = (
  index: number,
  overrides?: Partial<AudioDevice>
): AudioDevice => ({
  index,
  name: `Audio Device ${index}`,
  maxInputChannels: 2,
  defaultSampleRate: 48000,
  ...overrides,
});

describe('AudioStore', () => {
  let store: InstanceType<typeof AudioStore>;
  let mockAudioService: IAudioStreamService;

  beforeEach(() => {
    mockAudioService = {
      streamState$: of(AudioStreamState.Disconnected),
      getDevices: vi.fn().mockResolvedValue([]),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      setMasterVolume: vi.fn(),
      getMasterVolume: vi.fn().mockReturnValue(0.75),
    };

    TestBed.configureTestingModule({
      providers: [
        AudioStore,
        { provide: AUDIO_STREAM_SERVICE, useValue: mockAudioService },
      ],
    });

    store = TestBed.inject(AudioStore);
  });

  describe('Initial State', () => {
    it('should initialize with empty devices', () => {
      expect(store.devices()).toEqual([]);
    });

    it('should initialize with null selectedDeviceIndex', () => {
      expect(store.selectedDeviceIndex()).toBeNull();
    });

    it('should initialize with Disconnected streamState', () => {
      expect(store.streamState()).toBe(AudioStreamState.Disconnected);
    });

    it('should initialize with null error', () => {
      expect(store.error()).toBeNull();
    });

    it('should initialize with isLoading false', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have isStreaming false initially', () => {
      expect(store.isStreaming()).toBe(false);
    });

    it('should have isConnecting false initially', () => {
      expect(store.isConnecting()).toBe(false);
    });

    it('should have hasDevices false initially', () => {
      expect(store.hasDevices()).toBe(false);
    });

    it('should have selectedDevice null initially', () => {
      expect(store.selectedDevice()).toBeNull();
    });
  });

  describe('loadDevices', () => {
    it('should load devices successfully', async () => {
      const mockDevices = [
        createMockAudioDevice(0),
        createMockAudioDevice(1),
      ];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);

      await store.loadDevices();

      expect(store.devices()).toEqual(mockDevices);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('should set error when no devices found', async () => {
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await store.loadDevices();

      expect(store.devices()).toEqual([]);
      expect(store.error()).toBe('No audio devices found');
    });

    it('should set error when getDevices fails', async () => {
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to enumerate devices')
      );

      await store.loadDevices();

      expect(store.devices()).toEqual([]);
      expect(store.error()).toBe('Failed to enumerate devices');
      expect(store.isLoading()).toBe(false);
    });

    it('should set isLoading true during loading', async () => {
      let resolveDevices: ((value: AudioDevice[]) => void) | undefined;
      const devicesPromise = new Promise<AudioDevice[]>((resolve) => {
        resolveDevices = resolve;
      });
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockReturnValue(devicesPromise);

      const loadingPromise = store.loadDevices();

      expect(store.isLoading()).toBe(true);

      if (resolveDevices) {
        resolveDevices([createMockAudioDevice(0)]);
      }
      await loadingPromise;

      expect(store.isLoading()).toBe(false);
    });

    it('should clear previous error on successful load', async () => {
      // First load fails
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('First error')
      );
      await store.loadDevices();
      expect(store.error()).toBe('First error');

      // Second load succeeds
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createMockAudioDevice(0),
      ]);
      await store.loadDevices();
      expect(store.error()).toBeNull();
    });
  });

  describe('selectDevice', () => {
    it('should update selectedDeviceIndex', () => {
      store.selectDevice(0);
      expect(store.selectedDeviceIndex()).toBe(0);
    });

    it('should update selectedDevice computed', async () => {
      const mockDevices = [createMockAudioDevice(0), createMockAudioDevice(1)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();

      store.selectDevice(1);

      expect(store.selectedDevice()).toEqual(mockDevices[1]);
    });

    it('should return null for out of bounds index', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();

      store.selectDevice(99);

      expect(store.selectedDevice()).toBeNull();
    });

    it('should return null for negative index', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();

      store.selectDevice(-1);

      expect(store.selectedDevice()).toBeNull();
    });
  });

  describe('startStream', () => {
    it('should transition to Streaming state on success', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);

      await store.startStream('test-device-id');

      expect(store.streamState()).toBe(AudioStreamState.Streaming);
      expect(store.error()).toBeNull();
      expect(store.isStreaming()).toBe(true);
    });

    it('should call audioService.connect with deviceId', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);

      await store.startStream('my-device-123');

      expect(mockAudioService.connect).toHaveBeenCalledWith('my-device-123');
    });

    it('should set error when no device selected', async () => {
      await store.startStream('test-device-id');

      expect(store.streamState()).toBe(AudioStreamState.Error);
      expect(store.error()).toBe('No audio device selected');
    });

    it('should transition to Error state on connect failure', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection failed')
      );

      await store.startStream('test-device-id');

      expect(store.streamState()).toBe(AudioStreamState.Error);
      expect(store.error()).toBe('Connection failed');
    });

    it('should prevent double-start when already streaming', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);
      await store.startStream('test-device-id');

      // Try to start again
      await store.startStream('test-device-id');

      // Should only have been called once
      expect(mockAudioService.connect).toHaveBeenCalledTimes(1);
    });

    it('should prevent double-start when connecting', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);

      let resolveConnect: ((value: void) => void) | undefined;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockReturnValue(connectPromise);

      const firstStart = store.startStream('test-device-id');

      // Try to start again while connecting
      await store.startStream('test-device-id');

      // Should only have been called once
      expect(mockAudioService.connect).toHaveBeenCalledTimes(1);

      if (resolveConnect) {
        resolveConnect(void 0);
      }
      await firstStart;
    });

    it('should transition through Connecting state', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);

      let resolveConnect: ((value: void) => void) | undefined;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockReturnValue(connectPromise);

      const startPromise = store.startStream('test-device-id');

      // Should be in Connecting state during connection
      expect(store.streamState()).toBe(AudioStreamState.Connecting);
      expect(store.isConnecting()).toBe(true);

      if (resolveConnect) {
        resolveConnect(void 0);
      }
      await startPromise;

      // Should be Streaming after completion
      expect(store.streamState()).toBe(AudioStreamState.Streaming);
    });

    it('should clear previous error on start attempt', async () => {
      // Set up error state
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('First failure')
      );
      await store.startStream('test-device-id');
      expect(store.error()).toBe('First failure');

      // Retry should clear error during Connecting state
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      await store.startStream('test-device-id');
      expect(store.error()).toBeNull();
    });
  });

  describe('stopStream', () => {
    it('should transition to Disconnected state on success', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);
      await store.startStream('test-device-id');

      await store.stopStream();

      expect(store.streamState()).toBe(AudioStreamState.Disconnected);
      expect(store.isStreaming()).toBe(false);
    });

    it('should call audioService.disconnect', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);
      await store.startStream('test-device-id');

      await store.stopStream();

      expect(mockAudioService.disconnect).toHaveBeenCalled();
    });

    it('should be no-op when already disconnected', async () => {
      await store.stopStream();

      expect(mockAudioService.disconnect).not.toHaveBeenCalled();
    });

    it('should still set Disconnected state even on error', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);
      await store.startStream('test-device-id');
      (mockAudioService.disconnect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Disconnect failed')
      );

      await store.stopStream();

      expect(store.streamState()).toBe(AudioStreamState.Disconnected);
      expect(store.error()).toBe('Disconnect failed');
    });
  });

  describe('clearError', () => {
    it('should clear error and reset to Disconnected state', async () => {
      // Set up error state
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Test error')
      );
      await store.startStream('test-device-id');
      expect(store.error()).toBe('Test error');

      store.clearError();

      expect(store.error()).toBeNull();
      expect(store.streamState()).toBe(AudioStreamState.Disconnected);
    });
  });

  describe('Computed Selectors', () => {
    it('isStreaming should return true only when Streaming', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);

      expect(store.isStreaming()).toBe(false);

      await store.startStream('test-device-id');
      expect(store.isStreaming()).toBe(true);

      await store.stopStream();
      expect(store.isStreaming()).toBe(false);
    });

    it('isConnecting should return true only when Connecting', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);

      let resolveConnect: ((value: void) => void) | undefined;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockReturnValue(connectPromise);

      const startPromise = store.startStream('test-device-id');

      expect(store.isConnecting()).toBe(true);

      if (resolveConnect) {
        resolveConnect(void 0);
      }
      await startPromise;

      expect(store.isConnecting()).toBe(false);
    });

    it('hasDevices should return true when devices exist', async () => {
      expect(store.hasDevices()).toBe(false);

      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createMockAudioDevice(0),
      ]);
      await store.loadDevices();

      expect(store.hasDevices()).toBe(true);
    });

    it('selectedDevice should return correct device', async () => {
      const mockDevices = [
        createMockAudioDevice(0, { name: 'Device Zero' }),
        createMockAudioDevice(1, { name: 'Device One' }),
      ];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();

      store.selectDevice(0);
      expect(store.selectedDevice()?.name).toBe('Device Zero');

      store.selectDevice(1);
      expect(store.selectedDevice()?.name).toBe('Device One');
    });
  });

  describe('Happy Path', () => {
    it('should complete full lifecycle: loadDevices → selectDevice → startStream → stopStream', async () => {
      // Load devices
      const mockDevices = [
        createMockAudioDevice(0, { name: 'Test Microphone' }),
      ];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);

      await store.loadDevices();

      expect(store.hasDevices()).toBe(true);
      expect(store.devices()).toHaveLength(1);

      // Select device
      store.selectDevice(0);

      expect(store.selectedDevice()?.name).toBe('Test Microphone');

      // Start stream
      await store.startStream('teensy-device-123');

      expect(store.streamState()).toBe(AudioStreamState.Streaming);
      expect(store.isStreaming()).toBe(true);
      expect(store.error()).toBeNull();

      // Stop stream
      await store.stopStream();

      expect(store.streamState()).toBe(AudioStreamState.Disconnected);
      expect(store.isStreaming()).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after error', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);

      // First attempt fails
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection failed')
      );
      await store.startStream('test-device-id');
      expect(store.streamState()).toBe(AudioStreamState.Error);
      expect(store.error()).toBe('Connection failed');

      // Retry succeeds
      (mockAudioService.connect as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      await store.startStream('test-device-id');
      expect(store.streamState()).toBe(AudioStreamState.Streaming);
      expect(store.error()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty device list', async () => {
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await store.loadDevices();

      expect(store.devices()).toEqual([]);
      expect(store.hasDevices()).toBe(false);
      expect(store.error()).toBe('No audio devices found');
    });

    it('should handle rapid start/stop calls', async () => {
      const mockDevices = [createMockAudioDevice(0)];
      (mockAudioService.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevices);
      await store.loadDevices();
      store.selectDevice(0);

      await store.startStream('test-device-id');
      await store.stopStream();
      await store.startStream('test-device-id');
      await store.stopStream();

      expect(store.streamState()).toBe(AudioStreamState.Disconnected);
      expect(mockAudioService.connect).toHaveBeenCalledTimes(2);
      expect(mockAudioService.disconnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Mute/Volume State', () => {
    describe('Initial State', () => {
      it('should initialize isMuted to true', () => {
        expect(store.isMuted()).toBe(true);
      });

      it('should initialize masterVolume to 0', () => {
        expect(store.masterVolume()).toBe(0);
      });

      it('should initialize preMuteVolume to 0.75', () => {
        expect(store.preMuteVolume()).toBe(0.75);
      });
    });

    describe('toggleMute', () => {
      it('should unmute when currently muted, restoring preMuteVolume', () => {
        expect(store.isMuted()).toBe(true);

        store.toggleMute();

        expect(store.isMuted()).toBe(false);
        expect(store.masterVolume()).toBe(0.75);
      });

      it('should mute when currently unmuted, saving volume and setting to 0', () => {
        // Start unmuted
        store.toggleMute();
        expect(store.isMuted()).toBe(false);
        expect(store.masterVolume()).toBe(0.75);

        // Now mute
        store.toggleMute();

        expect(store.isMuted()).toBe(true);
        expect(store.masterVolume()).toBe(0);
        expect(store.preMuteVolume()).toBe(0.75);
      });

      it('should round-trip: mute then unmute restores original volume', () => {
        // Set a specific volume first
        store.setMasterVolume(0.6);
        expect(store.masterVolume()).toBe(0.6);

        // Mute
        store.toggleMute();
        expect(store.isMuted()).toBe(true);
        expect(store.masterVolume()).toBe(0);

        // Unmute - should restore 0.6
        store.toggleMute();
        expect(store.isMuted()).toBe(false);
        expect(store.masterVolume()).toBe(0.6);
      });

      it('should call audioService.setMasterVolume(0) when muting', () => {
        store.toggleMute(); // unmute first
        (mockAudioService.setMasterVolume as ReturnType<typeof vi.fn>).mockClear();

        store.toggleMute(); // mute

        expect(mockAudioService.setMasterVolume).toHaveBeenCalledWith(0);
      });

      it('should call audioService.setMasterVolume with preMuteVolume when unmuting', () => {
        (mockAudioService.setMasterVolume as ReturnType<typeof vi.fn>).mockClear();

        store.toggleMute(); // unmute from initial muted state

        expect(mockAudioService.setMasterVolume).toHaveBeenCalledWith(0.75);
      });
    });

    describe('setMasterVolume', () => {
      it('should auto-unmute when setting volume > 0 while muted', () => {
        expect(store.isMuted()).toBe(true);

        store.setMasterVolume(0.5);

        expect(store.isMuted()).toBe(false);
        expect(store.masterVolume()).toBe(0.5);
        expect(store.preMuteVolume()).toBe(0.5);
      });

      it('should auto-mute when setting volume to 0', () => {
        store.setMasterVolume(0.5); // unmute first
        expect(store.isMuted()).toBe(false);

        store.setMasterVolume(0);

        expect(store.isMuted()).toBe(true);
        expect(store.masterVolume()).toBe(0);
      });

      it('should not overwrite preMuteVolume when setting volume to 0', () => {
        store.setMasterVolume(0.5);
        expect(store.preMuteVolume()).toBe(0.5);

        store.setMasterVolume(0);

        expect(store.preMuteVolume()).toBe(0.5);
      });

      it('should clamp volume above 1.0 to 1.0', () => {
        store.setMasterVolume(1.5);

        expect(store.masterVolume()).toBe(1.0);
      });

      it('should clamp negative volume to 0', () => {
        store.setMasterVolume(-0.5);

        expect(store.masterVolume()).toBe(0);
        expect(store.isMuted()).toBe(true);
      });

      it('should call audioService.setMasterVolume with clamped value', () => {
        (mockAudioService.setMasterVolume as ReturnType<typeof vi.fn>).mockClear();

        store.setMasterVolume(0.5);

        expect(mockAudioService.setMasterVolume).toHaveBeenCalledWith(0.5);
      });

      it('should call audioService.setMasterVolume with clamped value for out-of-range input', () => {
        (mockAudioService.setMasterVolume as ReturnType<typeof vi.fn>).mockClear();

        store.setMasterVolume(1.5);

        expect(mockAudioService.setMasterVolume).toHaveBeenCalledWith(1.0);
      });
    });
  });
});
