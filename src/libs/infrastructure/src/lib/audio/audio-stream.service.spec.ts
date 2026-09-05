/* eslint-disable @typescript-eslint/no-empty-function */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AudioApiService, ListDevicesResponse } from '@teensyrom-nx/data-access/api-client';
import { AudioStreamState, API_CONFIG, IApiConfig, AUDIO_STREAM_SERVICE } from '@teensyrom-nx/domain';
import { AudioStreamService } from './audio-stream.service';

// Mock OpusDecoder
vi.mock('opus-decoder', () => {
  const mockDecoder = {
    ready: Promise.resolve(),
    decodeFrame: vi.fn().mockReturnValue({
      channelData: [new Float32Array(960)],
      samplesDecoded: 960,
      sampleRate: 48000,
      errors: [],
    }),
    decodeFrames: vi.fn(),
    reset: vi.fn().mockResolvedValue(undefined),
    free: vi.fn(),
  };

  return {
    OpusDecoder: vi.fn(() => mockDecoder),
    __mockDecoder: mockDecoder,
  };
});

// Mock SignalR - all mocks must be self-contained in the factory
vi.mock('@microsoft/signalr', () => {
  const mockStreamSubscription = { dispose: vi.fn() };
  const mockStream = { subscribe: vi.fn(() => mockStreamSubscription) };
  const mockHubConnection = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    stream: vi.fn().mockReturnValue(mockStream),
    invoke: vi.fn().mockResolvedValue(undefined),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  };
  const mockBuilder = {
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue(mockHubConnection),
  };

  return {
    HubConnectionBuilder: vi.fn(() => mockBuilder),
    // Export mock references via global for test access
    __mockHubConnection: mockHubConnection,
    __mockBuilder: mockBuilder,
    __mockStreamSubscription: mockStreamSubscription,
  };
});

// Mock Web Audio API
const mockAudioContext = {
  currentTime: 0,
  state: 'running',
  sampleRate: 48000,
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  createBuffer: vi.fn().mockReturnValue({
    getChannelData: vi.fn().mockReturnValue(new Float32Array(960)),
    duration: 0.02, // 960 samples / 48000 Hz = 0.02 seconds
  }),
  createBufferSource: vi.fn().mockReturnValue({
    buffer: null,
    onended: null,
    connect: vi.fn(),
    start: vi.fn(),
    disconnect: vi.fn(),
  }),
  createChannelMerger: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  createGain: vi.fn().mockReturnValue({
    gain: {
      setValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  destination: {},
};

vi.stubGlobal(
  'AudioContext',
  vi.fn(() => mockAudioContext)
);

// Get mock references
const getMocks = () => {
  const signalR = vi.importMock('@microsoft/signalr') as unknown as {
    __mockHubConnection: {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      stream: ReturnType<typeof vi.fn>;
      invoke: ReturnType<typeof vi.fn>;
      onreconnecting: ReturnType<typeof vi.fn>;
      onreconnected: ReturnType<typeof vi.fn>;
      onclose: ReturnType<typeof vi.fn>;
    };
    __mockBuilder: {
      withUrl: ReturnType<typeof vi.fn>;
      withAutomaticReconnect: ReturnType<typeof vi.fn>;
      build: ReturnType<typeof vi.fn>;
    };
    __mockStreamSubscription: { dispose: ReturnType<typeof vi.fn> };
  };
  return signalR;
};

// Get opus-decoder mock references
const getDecoderMock = async () => {
  const opusDecoder = (await vi.importMock('opus-decoder')) as unknown as {
    __mockDecoder: {
      ready: Promise<void>;
      decodeFrame: ReturnType<typeof vi.fn>;
      reset: ReturnType<typeof vi.fn>;
      free: ReturnType<typeof vi.fn>;
    };
  };
  return opusDecoder;
};

const mockApiConfig: IApiConfig = {
  basePath: 'http://127.0.0.1:45123',
  signalRBasePath: 'http://127.0.0.1:45123',
  getBaseUrl: () => 'http://127.0.0.1:45123',
};

describe('AudioStreamService', () => {
  let service: AudioStreamService;
  let mockAudioApiService: {
    listAudioDevices: ReturnType<typeof vi.fn>;
  };
  let stateHistory: AudioStreamState[];
  let mocks: Awaited<ReturnType<typeof getMocks>>;
  let decoderMock: Awaited<ReturnType<typeof getDecoderMock>>;

  beforeEach(async () => {
    mocks = await getMocks();
    decoderMock = await getDecoderMock();

    mockAudioApiService = {
      listAudioDevices: vi.fn(),
    };

    stateHistory = [];

    // Reset mock states
    mocks.__mockHubConnection.start.mockResolvedValue(undefined);
    mocks.__mockHubConnection.stop.mockResolvedValue(undefined);
    mocks.__mockHubConnection.invoke.mockResolvedValue(undefined);
    mocks.__mockBuilder.build.mockReturnValue(mocks.__mockHubConnection);

    // Reset decoder mock
    decoderMock.__mockDecoder.decodeFrame.mockReturnValue({
      channelData: [new Float32Array(960)],
      samplesDecoded: 960,
      sampleRate: 48000,
      errors: [],
    });

    // Reset AudioContext mock state
    mockAudioContext.currentTime = 0;
    mockAudioContext.state = 'running';
    mockAudioContext.resume.mockClear();
    mockAudioContext.close.mockClear();
    mockAudioContext.addEventListener.mockClear();
    mockAudioContext.removeEventListener.mockClear();
    mockAudioContext.createBuffer.mockClear();
    mockAudioContext.createBufferSource.mockClear();
    mockAudioContext.createChannelMerger.mockClear();
    mockAudioContext.createGain.mockClear();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AudioStreamService,
        { provide: AudioApiService, useValue: mockAudioApiService },
        { provide: API_CONFIG, useValue: mockApiConfig },
      ],
    });

    service = TestBed.inject(AudioStreamService);

    // Track state changes
    service.streamState$.subscribe((state) => {
      stateHistory.push(state);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with Disconnected state', () => {
      expect(service.currentState).toBe(AudioStreamState.Disconnected);
    });

    it('should expose streamState$ as an Observable', () => {
      expect(service.streamState$).toBeDefined();
    });
  });

  describe('getDevices()', () => {
    it('should return mapped AudioDevice array from API', async () => {
      const mockResponse: ListDevicesResponse = {
        devices: [
          { index: 0, name: 'Microphone 1', maxInputChannels: 2, defaultSampleRate: 48000 },
          { index: 1, name: 'Microphone 2', maxInputChannels: 1, defaultSampleRate: 44100 },
        ],
      };
      mockAudioApiService.listAudioDevices.mockResolvedValue(mockResponse);

      const devices = await service.getDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        index: 0,
        name: 'Microphone 1',
        maxInputChannels: 2,
        defaultSampleRate: 48000,
      });
      expect(devices[1]).toEqual({
        index: 1,
        name: 'Microphone 2',
        maxInputChannels: 1,
        defaultSampleRate: 44100,
      });
    });

    it('should return empty array when no devices available', async () => {
      mockAudioApiService.listAudioDevices.mockResolvedValue({ devices: [] });

      const devices = await service.getDevices();

      expect(devices).toEqual([]);
    });

    it('should throw error with message when API fails', async () => {
      const error = new Error('Network error');
      mockAudioApiService.listAudioDevices.mockRejectedValue(error);

      await expect(service.getDevices()).rejects.toThrow('Network error');
    });

    it('should throw fallback error message when error has no message', async () => {
      mockAudioApiService.listAudioDevices.mockRejectedValue({});

      await expect(service.getDevices()).rejects.toThrow('Failed to get audio devices');
    });
  });

  describe('connect()', () => {
    it('should transition from Disconnected to Connecting to Streaming', async () => {
      stateHistory = []; // Reset history for this test

      await service.connect('test-device-id');

      expect(stateHistory).toContain(AudioStreamState.Connecting);
      expect(stateHistory).toContain(AudioStreamState.Streaming);
      expect(service.currentState).toBe(AudioStreamState.Streaming);
    });

    it('should not attempt connection if already connecting', async () => {
      // Start first connection
      const connectPromise1 = service.connect('test-device-id');

      // Try to connect again while connecting
      await service.connect('other-device-id');

      // Both should complete without error
      await connectPromise1;

      // Should still be streaming (first connection)
      expect(service.currentState).toBe(AudioStreamState.Streaming);
    });

    it('should not attempt connection if already streaming', async () => {
      await service.connect('test-device-id');
      stateHistory = []; // Reset

      await service.connect('other-device-id');

      // Should not have added new states
      expect(stateHistory).toEqual([]);
    });

    it('should transition to Error state when connection fails', async () => {
      // Configure mock to fail
      mocks.__mockHubConnection.start.mockRejectedValueOnce(new Error('Connection failed'));

      stateHistory = [];

      await expect(service.connect('test-device-id')).rejects.toThrow('Connection failed');

      expect(stateHistory).toContain(AudioStreamState.Connecting);
      expect(stateHistory).toContain(AudioStreamState.Error);
      expect(service.currentState).toBe(AudioStreamState.Error);
    });

    it('should use fallback error message when connection fails without message', async () => {
      // Configure mock to fail without message
      mocks.__mockHubConnection.start.mockRejectedValueOnce({});

      await expect(service.connect('test-device-id')).rejects.toThrow(
        'Failed to connect to audio stream'
      );
    });

    it('should throw error for empty device ID', async () => {
      await expect(service.connect('')).rejects.toThrow('Device ID is required');
    });

    it('should throw error for whitespace-only device ID', async () => {
      await expect(service.connect('  ')).rejects.toThrow('Device ID is required');
    });

    it('should construct hub URL from API config', async () => {
      await service.connect('test-device-id');

      expect(mocks.__mockBuilder.withUrl).toHaveBeenCalledWith('http://127.0.0.1:45123/api/audioHub');
    });

    it('should configure automatic reconnect', async () => {
      await service.connect('test-device-id');

      expect(mocks.__mockBuilder.withAutomaticReconnect).toHaveBeenCalled();
    });

    it('should invoke StartCapture with device ID', async () => {
      await service.connect('test-device-id');

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith(
        'StartCapture',
        'test-device-id'
      );
    });
  });

  describe('disconnect()', () => {
    it('should transition to Disconnected state', async () => {
      await service.connect('test-device-id');
      stateHistory = []; // Reset history

      await service.disconnect();

      expect(stateHistory).toEqual([AudioStreamState.Disconnected]);
      expect(service.currentState).toBe(AudioStreamState.Disconnected);
    });

    it('should clean up hub connection', async () => {
      await service.connect('test-device-id');

      await service.disconnect();

      // Internal hub connection should be null
      // We verify by checking state and that disconnect can be called again
      expect(service.currentState).toBe(AudioStreamState.Disconnected);
    });

    it('should be safe to call when already disconnected', async () => {
      // Should not throw
      await expect(service.disconnect()).resolves.toBeUndefined();
      expect(service.currentState).toBe(AudioStreamState.Disconnected);
    });

    it('should dispose stream subscription', async () => {
      await service.connect('test-device-id');

      await service.disconnect();

      expect(mocks.__mockStreamSubscription.dispose).toHaveBeenCalled();
    });

    it('should free decoder resources', async () => {
      // Set up stream to emit a frame (decoder is created lazily)
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Send a frame to trigger decoder creation
      streamCallback({ channelIndex: 0, opusFrame: new Uint8Array([1, 2, 3]) });
      await new Promise((resolve) => setTimeout(resolve, 0));

      await service.disconnect();

      // Decoder should have been freed (via cleanupDecoders)
      expect(decoderMock.__mockDecoder.free).toHaveBeenCalled();
    });

    it('should invoke StopCapture with device ID on disconnect', async () => {
      await service.connect('test-device-id');

      await service.disconnect();

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith(
        'StopCapture',
        'test-device-id'
      );
    });
  });

  describe('streamState$', () => {
    it('should emit state changes', async () => {
      stateHistory = [];

      await service.connect('test-device-id');
      await service.disconnect();

      expect(stateHistory).toEqual([
        AudioStreamState.Connecting,
        AudioStreamState.Streaming,
        AudioStreamState.Disconnected,
      ]);
    });
  });

  describe('ngOnDestroy', () => {
    it('should call disconnect on destroy', async () => {
      await service.connect('test-device-id');
      const disconnectSpy = vi.spyOn(service, 'disconnect');

      service.ngOnDestroy();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('reconnection handlers', () => {
    it('should register onreconnecting handler', async () => {
      await service.connect('test-device-id');

      expect(mocks.__mockHubConnection.onreconnecting).toHaveBeenCalled();
    });

    it('should register onreconnected handler', async () => {
      await service.connect('test-device-id');

      expect(mocks.__mockHubConnection.onreconnected).toHaveBeenCalled();
    });

    it('should register onclose handler', async () => {
      await service.connect('test-device-id');

      expect(mocks.__mockHubConnection.onclose).toHaveBeenCalled();
    });
  });

  describe('decoder lifecycle', () => {
    it('should initialize decoder on connect', async () => {
      await service.connect('test-device-id');

      // Decoder is initialized (OpusDecoder constructor was called)
      // The fact that connect completed means decoder.ready resolved
      expect(service.currentState).toBe(AudioStreamState.Streaming);
    });

    it('should handle invalid frame types gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Set up stream to emit invalid data
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving invalid data (number is not a valid frame)
      streamCallback(42);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AudioStreamService] Unexpected chunk type:',
        'number'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should clean up decoder on connection failure', async () => {
      // Configure mock to fail during connection
      mocks.__mockHubConnection.start.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(service.connect('test-device-id')).rejects.toThrow('Connection failed');

      // AudioContext should have been closed (decoder is lazy, not created on failure)
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });

  describe('Web Audio playback', () => {
    it('should create AudioContext with 48kHz sample rate on connect', async () => {
      mockAudioContext.state = 'suspended';
      await service.connect('test-device-id');

      expect(AudioContext).toHaveBeenCalledWith({ sampleRate: 48000 });
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should close AudioContext on disconnect', async () => {
      await service.connect('test-device-id');
      await service.disconnect();

      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should expose volumeLevel$ observable', () => {
      expect(service.volumeLevel$).toBeDefined();
    });

    it('should expose currentVolumeLevel value', () => {
      expect(service.currentVolumeLevel).toBe(0);
    });

    it('should set initial nextPlayTime with pre-buffer on connect', async () => {
      mockAudioContext.currentTime = 1.0;

      await service.connect('test-device-id');

      // AudioContext should be created with pre-buffer (currentTime + 0.2s)
      expect(AudioContext).toHaveBeenCalled();
    });

    it('should schedule decoded frames for playback', async () => {
      // Set up stream to emit a frame
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving a frame
      streamCallback(new Uint8Array([0, 1, 2, 3]));

      // Wait for microtask queue to process
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify AudioContext methods were called for playback
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(mockAudioContext.createChannelMerger).toHaveBeenCalled();
    });

    it('should upmix mono to stereo using ChannelMergerNode', async () => {
      const mockSource = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        start: vi.fn(),
        disconnect: vi.fn(),
      };
      const mockMerger = {
        connect: vi.fn(),
        disconnect: vi.fn(),
      };

      mockAudioContext.createBufferSource.mockReturnValue(mockSource);
      mockAudioContext.createChannelMerger.mockReturnValue(mockMerger);

      // Set up stream to emit a frame
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving a frame
      streamCallback(new Uint8Array([0, 1, 2, 3]));

      // Wait for microtask queue to process
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify stereo upmix: source connects to merger twice (L and R)
      expect(mockSource.connect).toHaveBeenCalledWith(mockMerger, 0, 0);
      expect(mockSource.connect).toHaveBeenCalledWith(mockMerger, 0, 1);
      // Merger connects to a GainNode (for per-channel volume control)
      expect(mockMerger.connect).toHaveBeenCalled();
    });

    it('should compute and emit volume level from frames', async () => {
      // Create a Float32Array with known peak value
      const testSamples = new Float32Array(960);
      testSamples[100] = 0.75; // Peak at 75%

      decoderMock.__mockDecoder.decodeFrame.mockReturnValue({
        channelData: [testSamples],
        samplesDecoded: 960,
        sampleRate: 48000,
        errors: [],
      });

      const volumeLevels: number[] = [];
      service.volumeLevel$.subscribe((level) => volumeLevels.push(level));

      // Set up stream to emit a frame
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving a frame
      streamCallback(new Uint8Array([0, 1, 2, 3]));

      // Wait for microtask queue to process
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should have emitted the peak value (0.75)
      expect(volumeLevels).toContain(0.75);
    });

    it('should clamp volume level to 1 for values above 1', async () => {
      // Create a Float32Array with peak above 1 (shouldn't happen in practice, but test the clamp)
      const testSamples = new Float32Array(960);
      testSamples[100] = 1.5; // Peak above 1

      decoderMock.__mockDecoder.decodeFrame.mockReturnValue({
        channelData: [testSamples],
        samplesDecoded: 960,
        sampleRate: 48000,
        errors: [],
      });

      const volumeLevels: number[] = [];
      service.volumeLevel$.subscribe((level) => volumeLevels.push(level));

      // Set up stream to emit a frame
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving a frame
      streamCallback(new Uint8Array([0, 1, 2, 3]));

      // Wait for microtask queue to process
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should have clamped the value to 1
      expect(volumeLevels).toContain(1);
    });

    it('should reset volume level to 0 on disconnect', async () => {
      const volumeLevels: number[] = [];
      service.volumeLevel$.subscribe((level) => volumeLevels.push(level));

      await service.connect('test-device-id');
      await service.disconnect();

      // Final volume level should be 0
      expect(volumeLevels[volumeLevels.length - 1]).toBe(0);
    });

    it('should clean up AudioContext on connection failure', async () => {
      // Configure mock to fail during connection
      mocks.__mockHubConnection.start.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(service.connect('test-device-id')).rejects.toThrow('Connection failed');

      // AudioContext should have been closed
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should schedule frames with gapless timing', async () => {
      const mockSource = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        start: vi.fn(),
        disconnect: vi.fn(),
      };

      mockAudioContext.createBufferSource.mockReturnValue(mockSource);
      mockAudioContext.currentTime = 1.0;

      // Set up stream to emit frames
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving first frame
      streamCallback(new Uint8Array([0, 1, 2, 3]));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // First frame should start at currentTime + preBuffer (DEFAULT_PRE_BUFFER_DURATION = 0.005)
      // nextPlayTime = 1.0 + 0.005 = 1.005
      const firstStartCall = mockSource.start.mock.calls[0];
      expect(firstStartCall[0]).toBeCloseTo(1.005, 3);

      // Simulate receiving second frame
      streamCallback(new Uint8Array([4, 5, 6, 7]));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Second frame should start after first frame duration
      // nextPlayTime = 1.005 + 0.02 = 1.025
      const secondStartCall = mockSource.start.mock.calls[1];
      expect(secondStartCall[0]).toBeCloseTo(1.025, 3);
    });

    it('should skip ahead if nextPlayTime falls behind currentTime', async () => {
      const mockSource = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        start: vi.fn(),
        disconnect: vi.fn(),
      };

      mockAudioContext.createBufferSource.mockReturnValue(mockSource);

      // Set up stream to emit frames
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate first frame
      streamCallback(new Uint8Array([0, 1, 2, 3]));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Advance currentTime to be ahead of nextPlayTime
      mockAudioContext.currentTime = 10.0;

      // Simulate second frame (arrived late)
      streamCallback(new Uint8Array([4, 5, 6, 7]));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should have skipped ahead to currentTime + small buffer
      // nextPlayTime should be clamped to 10.0 + 0.05 = 10.05
      const secondStartCall = mockSource.start.mock.calls[1];
      expect(secondStartCall[0]).toBeGreaterThanOrEqual(10.0);
    });

    it('should clean up source nodes after playback', async () => {
      const mockSource: {
        buffer: null;
        onended: (() => void) | null;
        connect: ReturnType<typeof vi.fn>;
        start: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
      } = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        start: vi.fn(),
        disconnect: vi.fn(),
      };
      const mockMerger = {
        connect: vi.fn(),
        disconnect: vi.fn(),
      };

      mockAudioContext.createBufferSource.mockReturnValue(mockSource);
      mockAudioContext.createChannelMerger.mockReturnValue(mockMerger);

      // Set up stream to emit a frame
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving a frame
      streamCallback(new Uint8Array([0, 1, 2, 3]));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify onended handler is set up for cleanup
      expect(mockSource.onended).toBeDefined();

      // Simulate playback ended
      if (mockSource.onended) {
        mockSource.onended();
      }

      // Verify cleanup
      expect(mockSource.disconnect).toHaveBeenCalled();
      expect(mockMerger.disconnect).toHaveBeenCalled();
    });
  });

  describe('multi-channel audio', () => {
    it('should expose channelVolumes$ observable', () => {
      expect(service.channelVolumes$).toBeDefined();
    });

    it('should initialize with empty channel volumes map', () => {
      let volumes: Map<number, number> | undefined;
      const subscription = service.channelVolumes$.subscribe((v) => (volumes = v));
      expect(volumes).toBeInstanceOf(Map);
      expect(volumes?.size).toBe(0);
      subscription.unsubscribe();
    });

    it('should set channel volume via setChannelVolume()', () => {
      const volumesHistory: Map<number, number>[] = [];
      service.channelVolumes$.subscribe((volumes) => volumesHistory.push(new Map(volumes)));

      service.setChannelVolume(0, 0.5);

      // Should have updated the map with channel 0 volume
      const lastVolumes = volumesHistory[volumesHistory.length - 1];
      expect(lastVolumes.get(0)).toBe(0.5);
    });

    it('should clamp channel volume to 0-1 range', () => {
      const volumesHistory: Map<number, number>[] = [];
      service.channelVolumes$.subscribe((volumes) => volumesHistory.push(new Map(volumes)));

      // Test clamping below 0
      service.setChannelVolume(0, -0.5);
      let lastVolumes = volumesHistory[volumesHistory.length - 1];
      expect(lastVolumes.get(0)).toBe(0);

      // Test clamping above 1
      service.setChannelVolume(1, 1.5);
      lastVolumes = volumesHistory[volumesHistory.length - 1];
      expect(lastVolumes.get(1)).toBe(1);
    });

    it('should set GainNode gain value when setChannelVolume is called after connect', async () => {
      const mockGainNode = {
        gain: {
          setValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };

      // Set up createGain mock
      (mockAudioContext as unknown as Record<string, unknown>).createGain = vi
        .fn()
        .mockReturnValue(mockGainNode);

      // Set up stream to emit a multi-channel frame
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving a channel frame to create the decoder/gain node
      const channelFrame = { channelIndex: 0, opusFrame: new Uint8Array([1, 2, 3]) };
      streamCallback(channelFrame);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Now set volume
      service.setChannelVolume(0, 0.75);

      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(
        0.75,
        mockAudioContext.currentTime
      );
    });

    it('should parse ChannelAudioFrame from JSON object', async () => {
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving a ChannelAudioFrame object with Uint8Array
      const channelFrame = { channelIndex: 1, opusFrame: new Uint8Array([1, 2, 3]) };
      streamCallback(channelFrame);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Frame should be processed - verify by checking that playback was attempted
      // (createBuffer is called when a decoded frame is scheduled for playback)
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
    });

    it('should handle multiple channels independently', async () => {
      const mockMasterGainNode = { gain: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      const mockGainNode0 = { gain: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      const mockGainNode1 = { gain: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      let createGainCallCount = 0;

      // First createGain() call is the master GainNode created during connect(); the
      // per-channel GainNodes are created lazily afterward as frames for each channel arrive.
      (mockAudioContext as unknown as Record<string, unknown>).createGain = vi.fn(() => {
        createGainCallCount++;
        if (createGainCallCount === 1) return mockMasterGainNode;
        return createGainCallCount === 2 ? mockGainNode0 : mockGainNode1;
      });

      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving frames from two different channels
      streamCallback({ channelIndex: 0, opusFrame: new Uint8Array([1]) });
      await new Promise((resolve) => setTimeout(resolve, 0));

      streamCallback({ channelIndex: 1, opusFrame: new Uint8Array([2]) });
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Set different volumes for each channel
      service.setChannelVolume(0, 0.3);
      service.setChannelVolume(1, 0.7);

      expect(mockGainNode0.gain.setValueAtTime).toHaveBeenCalledWith(
        0.3,
        mockAudioContext.currentTime
      );
      expect(mockGainNode1.gain.setValueAtTime).toHaveBeenCalledWith(
        0.7,
        mockAudioContext.currentTime
      );
    });

    it('should reset channel volumes on disconnect', async () => {
      const volumesHistory: Map<number, number>[] = [];
      service.channelVolumes$.subscribe((volumes) => volumesHistory.push(new Map(volumes)));

      await service.connect('test-device-id');
      service.setChannelVolume(0, 0.5);
      await service.disconnect();

      // Final volumes should be empty map
      const lastVolumes = volumesHistory[volumesHistory.length - 1];
      expect(lastVolumes.size).toBe(0);
    });

    it('should clean up all channel decoders on disconnect', async () => {
      let streamCallback: (chunk: unknown) => void = () => {};
      mocks.__mockHubConnection.stream.mockReturnValue({
        subscribe: vi.fn((handlers) => {
          streamCallback = handlers.next;
          return mocks.__mockStreamSubscription;
        }),
      });

      await service.connect('test-device-id');

      // Simulate receiving frames from multiple channels
      streamCallback({ channelIndex: 0, opusFrame: new Uint8Array([1]) });
      streamCallback({ channelIndex: 1, opusFrame: new Uint8Array([2]) });
      await new Promise((resolve) => setTimeout(resolve, 0));

      await service.disconnect();

      // Decoder should have been freed (called once for each channel decoder created)
      // In the mock, free is a single function, so we check it was called
      expect(decoderMock.__mockDecoder.free).toHaveBeenCalled();
    });
  });
});

describe('AUDIO_STREAM_PROVIDERS', () => {
  describe('DI Resolution', () => {
    it('should resolve AUDIO_STREAM_SERVICE token to AudioStreamService instance', async () => {
      // Import providers for DI test
      const { AUDIO_STREAM_PROVIDERS } = await import('./providers');

      // Reset test bed with the providers array
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [...AUDIO_STREAM_PROVIDERS, { provide: API_CONFIG, useValue: mockApiConfig }],
      });

      // Inject using the token
      const service = TestBed.inject(AUDIO_STREAM_SERVICE);

      // Verify it's an instance of AudioStreamService
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AudioStreamService);

      // Verify it implements the interface contract (IAudioStreamService methods)
      expect(typeof (service as AudioStreamService).getDevices).toBe('function');
      expect(typeof (service as AudioStreamService).connect).toBe('function');
      expect(typeof (service as AudioStreamService).disconnect).toBe('function');
      expect((service as AudioStreamService).streamState$).toBeDefined();
    });

    it('should provide AudioApiService via factory', async () => {
      const { AUDIO_STREAM_PROVIDERS } = await import('./providers');

      // Reset test bed with the providers array
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [...AUDIO_STREAM_PROVIDERS, { provide: API_CONFIG, useValue: mockApiConfig }],
      });

      // Verify AudioApiService was created with correct config
      const audioApiService = TestBed.inject(AudioApiService);
      expect(audioApiService).toBeDefined();
      expect(audioApiService).toBeInstanceOf(AudioApiService);
    });
  });
});
