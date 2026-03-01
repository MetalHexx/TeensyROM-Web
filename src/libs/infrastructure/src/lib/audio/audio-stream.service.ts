import { Injectable, Inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { AudioApiService } from '@teensyrom-nx/data-access/api-client';
import {
  IAudioStreamService,
  AudioDevice,
  AudioStreamState,
  API_CONFIG,
  IApiConfig,
  ChannelAudioFrame,
} from '@teensyrom-nx/domain';
import { LogType, logInfo } from '@teensyrom-nx/utils';
import { OpusDecoder } from 'opus-decoder';

/** Sample rate for Opus audio (48kHz) */
const SAMPLE_RATE = 48000;

/** Default pre-buffer duration in seconds to absorb network jitter */
const DEFAULT_PRE_BUFFER_DURATION = 0.005; // 5ms

/** Default catch-up padding in seconds added when playback falls behind */
const DEFAULT_CATCH_UP_PADDING = 0.001; // 1ms

/**
 * Represents a decoded audio frame with channel information.
 * Contains Float32Array PCM samples at 48kHz sample rate.
 */
export interface DecodedChannelFrame {
  /** The 0-based channel index */
  channelIndex: number;
  /** PCM samples as Float32Array (mono channel) */
  channelData: Float32Array;
  /** Number of samples decoded */
  samplesDecoded: number;
  /** Sample rate (always 48000 for Opus) */
  sampleRate: number;
}

/**
 * SignalR service for audio streaming operations.
 * Manages connection lifecycle to the backend AudioHub, device enumeration,
 * multi-channel Opus frame decoding, per-channel volume control via GainNode,
 * and Web Audio API playback with mono-to-stereo upmix.
 */
@Injectable()
export class AudioStreamService implements IAudioStreamService, OnDestroy {
  private readonly _streamState$ = new BehaviorSubject<AudioStreamState>(
    AudioStreamState.Disconnected
  );
  private readonly _decodedChannelFrame$ = new Subject<DecodedChannelFrame>();
  private readonly _volumeLevel$ = new BehaviorSubject<number>(0);
  private readonly _channelVolumes$ = new BehaviorSubject<Map<number, number>>(new Map());

  private hubConnection: signalR.HubConnection | null = null;
  private streamSubscription: signalR.ISubscription<unknown> | null = null;
  private decodedFrameSubscription: Subscription | null = null;
  private activeDeviceId: string | null = null;

  // Multi-channel decoder management
  private readonly decoders = new Map<number, OpusDecoder<48000>>();

  // Web Audio API resources
  private audioContext: AudioContext | null = null;
  private readonly nextPlayTimes = new Map<number, number>();
  private readonly gainNodes = new Map<number, GainNode>();
  private levelDecayTimer: ReturnType<typeof setInterval> | null = null;
  private audioUnlockCleanup: (() => void) | null = null;
  private readonly loggedChannelConnectionInfo = new Set<number>();

  // Configurable latency tuning parameters
  private preBufferDuration = DEFAULT_PRE_BUFFER_DURATION;
  private catchUpPadding = DEFAULT_CATCH_UP_PADDING;

  // Opus encoding toggle - when false, raw PCM is used for lowest latency
  private useOpusEncoding = true;

  /** Observable stream of connection state changes */
  get streamState$(): Observable<AudioStreamState> {
    return this._streamState$.asObservable();
  }

  /** Current stream state value */
  get currentState(): AudioStreamState {
    return this._streamState$.getValue();
  }

  /** Observable stream of volume level (0-1) for VU meter display (aggregate) */
  get volumeLevel$(): Observable<number> {
    return this._volumeLevel$.asObservable();
  }

  /** Observable stream of per-channel volume levels (0-1) as a Map keyed by channel index */
  get channelVolumes$(): Observable<Map<number, number>> {
    return this._channelVolumes$.asObservable();
  }

  /** Current volume level value (0-1) */
  get currentVolumeLevel(): number {
    return this._volumeLevel$.getValue();
  }

  /**
   * Sets the volume for a specific channel (0-1).
   * Adjusts the GainNode for the specified channel.
   * @param channelIndex - The 0-based channel index
   * @param volume - Volume level from 0 (muted) to 1 (full)
   */
  setChannelVolume(channelIndex: number, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    // Update the GainNode if it exists
    const gainNode = this.gainNodes.get(channelIndex);
    if (gainNode) {
      gainNode.gain.setValueAtTime(clampedVolume, this.audioContext?.currentTime ?? 0);
    }

    // Also update the volume map for UI display
    const currentVolumes = new Map(this._channelVolumes$.getValue());
    currentVolumes.set(channelIndex, clampedVolume);
    this._channelVolumes$.next(currentVolumes);
  }

  constructor(
    private readonly audioApiService: AudioApiService,
    @Inject(API_CONFIG) private readonly apiConfig: IApiConfig
  ) {}

  /**
   * Sets the pre-buffer duration in seconds.
   * Controls how far ahead of real-time audio is scheduled.
   * Lower values = less latency, higher risk of gaps.
   * Takes effect immediately on the next frame — resets all channel timing.
   * @param seconds - Duration in seconds (clamped to 0.005–1.0)
   */
  setPreBufferDuration(seconds: number): void {
    this.preBufferDuration = Math.max(0.005, Math.min(1.0, seconds));
    // Reset all channel play times so the new value takes effect immediately
    this.nextPlayTimes.clear();
  }

  /** Gets the current pre-buffer duration in seconds */
  getPreBufferDuration(): number {
    return this.preBufferDuration;
  }

  /**
   * Sets the catch-up padding in seconds.
   * Controls the buffer added when playback falls behind real-time.
   * Lower values = snappier recovery, higher risk of underrun.
   * Takes effect immediately on the next late frame.
   * @param seconds - Duration in seconds (clamped to 0.001–0.5)
   */
  setCatchUpPadding(seconds: number): void {
    this.catchUpPadding = Math.max(0.001, Math.min(0.5, seconds));
  }

  /** Gets the current catch-up padding in seconds */
  getCatchUpPadding(): number {
    return this.catchUpPadding;
  }

  /**
   * Sets whether Opus encoding is enabled.
   * When true (default), audio is compressed via Opus (~16 KB/s per channel).
   * When false, raw PCM is used for lowest latency (~188 KB/s per channel).
   * @param enabled - Whether to use Opus encoding
   */
  setUseOpusEncoding(enabled: boolean): void {
    this.useOpusEncoding = enabled;
  }

  /** Gets whether Opus encoding is currently enabled */
  getUseOpusEncoding(): boolean {
    return this.useOpusEncoding;
  }

  /**
   * Gets the list of available audio input devices from the host system.
   * @returns Promise resolving to array of AudioDevice domain models
   */
  async getDevices(): Promise<AudioDevice[]> {
    try {
      const response = await this.audioApiService.listAudioDevices();
      return response.devices.map((dto) => ({
        index: dto.index,
        name: dto.name,
        maxInputChannels: dto.maxInputChannels,
        defaultSampleRate: dto.defaultSampleRate,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get audio devices';
      throw new Error(message);
    }
  }

  /**
   * Connects to the audio stream for the specified device.
   * Transitions state: Disconnected -> Connecting -> Streaming (or Error on failure)
   * @param deviceId - The device index as a string
   */
  async connect(deviceId: string): Promise<void> {
    // Guard against connecting when already connected/connecting
    if (
      this.currentState === AudioStreamState.Connecting ||
      this.currentState === AudioStreamState.Streaming
    ) {
      return;
    }

    this._streamState$.next(AudioStreamState.Connecting);

    try {
      this.loggedChannelConnectionInfo.clear();
      logInfo(LogType.Info, 'AudioStream: Connecting', {
        deviceId,
        codec: this.useOpusEncoding ? 'opus' : 'raw-pcm',
        sampleRate: SAMPLE_RATE,
      });

      // Initialize Web Audio playback pipeline
      await this.initAudioPlayback();

      const hubUrl = `${this.apiConfig.signalRBasePath}/api/audioHub`;

      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Retry with exponential backoff: 0s, 2s, 10s, 30s, then 60s
            if (retryContext.previousRetryCount === 0) return 0;
            if (retryContext.previousRetryCount === 1) return 2000;
            if (retryContext.previousRetryCount === 2) return 10000;
            if (retryContext.previousRetryCount === 3) return 30000;
            return 60000;
          },
        })
        .build();

      // Set up reconnection handlers
      this.setupReconnectionHandlers();

      await this.hubConnection.start();
      logInfo(LogType.Info, 'AudioStream: SignalR hub connected', {
        deviceId,
        hubUrl,
      });

      // Subscribe to the audio stream
      await this.subscribeToStream(deviceId);

      this._streamState$.next(AudioStreamState.Streaming);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect to audio stream';
      this.cleanupDecoders();
      this.cleanupAudioPlayback();
      this._streamState$.next(AudioStreamState.Error);
      throw new Error(message);
    }
  }

  /**
   * Disconnects from the current audio stream and cleans up resources.
   * Transitions state to Disconnected.
   */
  async disconnect(): Promise<void> {
    // Clean up stream subscription
    if (this.streamSubscription) {
      this.streamSubscription.dispose();
      this.streamSubscription = null;
    }

    // Clean up decoded frame subscription
    if (this.decodedFrameSubscription) {
      this.decodedFrameSubscription.unsubscribe();
      this.decodedFrameSubscription = null;
    }

    // Stop audio capture on the server before disconnecting
    if (this.hubConnection && this.activeDeviceId) {
      try {
        await this.hubConnection.invoke('StopCapture', this.activeDeviceId);
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.activeDeviceId = null;

    // Stop the hub connection
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
      } catch {
        // Ignore errors during disconnect - we're cleaning up
      }
      this.hubConnection = null;
    }

    // Clean up all decoder resources
    this.cleanupDecoders();

    // Clean up Web Audio playback resources
    this.cleanupAudioPlayback();

    this._streamState$.next(AudioStreamState.Disconnected);
  }

  /**
   * Gets or creates an Opus decoder for the specified channel.
   * Decoders are created lazily as new channel indices are encountered.
   * @param channelIndex - The channel index to get/create a decoder for
   * @returns The Opus decoder for the channel
   * @private
   */
  private async getOrCreateDecoder(channelIndex: number): Promise<OpusDecoder<48000>> {
    let decoder = this.decoders.get(channelIndex);
    if (!decoder) {
      // Create decoder with mono configuration at 48kHz
      decoder = new OpusDecoder({
        channels: 1,
        sampleRate: 48000,
        streamCount: 1,
        coupledStreamCount: 0,
        channelMappingTable: [0],
      });
      await decoder.ready;
      this.decoders.set(channelIndex, decoder);
    }
    return decoder;
  }

  /**
   * Gets or creates a GainNode for the specified channel.
   * @param channelIndex - The channel index to get/create a GainNode for
   * @returns The GainNode for the channel
   * @private
   */
  private getOrCreateGainNode(channelIndex: number): GainNode | null {
    if (!this.audioContext) return null;

    let gainNode = this.gainNodes.get(channelIndex);
    if (!gainNode) {
      gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
      gainNode.connect(this.audioContext.destination);
      this.gainNodes.set(channelIndex, gainNode);
    }
    return gainNode;
  }

  /**
   * Gets or creates the next play time for a channel.
   * @param channelIndex - The channel index
   * @returns The next play time for the channel
   * @private
   */
  private getNextPlayTime(channelIndex: number): number {
    let nextPlayTime = this.nextPlayTimes.get(channelIndex);
    if (nextPlayTime === undefined) {
      // Initialize with pre-buffer
      nextPlayTime = (this.audioContext?.currentTime ?? 0) + this.preBufferDuration;
      this.nextPlayTimes.set(channelIndex, nextPlayTime);
    }
    return nextPlayTime;
  }

  /**
   * Decodes an Opus frame to PCM audio samples for a specific channel.
   * @param channelIndex - The channel index
   * @param opusFrame - Raw Opus frame bytes from the server
   * @returns Decoded channel frame or null if decoding failed
   * @private
   */
  private async decodeFrame(
    channelIndex: number,
    opusFrame: Uint8Array
  ): Promise<DecodedChannelFrame | null> {
    try {
      const decoder = await this.getOrCreateDecoder(channelIndex);
      const decoded = decoder.decodeFrame(opusFrame);

      // Check for decoding errors
      if (decoded.errors.length > 0) {
        for (const error of decoded.errors) {
          console.warn(
            `[AudioStreamService] Decode error on channel ${channelIndex}: ${error.message} (frame ${error.frameNumber})`
          );
        }
        // Still return the decoded audio - decoder will continue with gaps
      }

      return {
        channelIndex,
        channelData: decoded.channelData[0],
        samplesDecoded: decoded.samplesDecoded,
        sampleRate: decoded.sampleRate,
      };
    } catch (error) {
      // Handle unexpected decoding errors gracefully
      const message = error instanceof Error ? error.message : 'Unknown decode error';
      console.warn(`[AudioStreamService] Failed to decode frame on channel ${channelIndex}: ${message}`);
      return null;
    }
  }

  /**
   * Converts raw PCM bytes directly to Float32Array.
   * Used when Opus encoding is disabled for lowest latency.
   * @param bytes - Raw PCM bytes (3840 bytes = 960 float samples at 48kHz/20ms)
   * @returns Float32Array of PCM samples
   * @private
   */
  private bytesToFloat32(bytes: Uint8Array): Float32Array {
    // Create a view of the bytes as Float32 values
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  }

  /**
   * Processes an incoming audio frame - either decodes Opus or converts raw PCM.
   * @param channelIndex - The channel index
   * @param frameData - Frame data (either Opus encoded or raw PCM)
   * @returns Decoded channel frame or null if processing failed
   * @private
   */
  private async processFrame(
    channelIndex: number,
    frameData: Uint8Array
  ): Promise<DecodedChannelFrame | null> {
    if (this.useOpusEncoding) {
      // Opus decoding path (default) - ~320 bytes per frame
      return this.decodeFrame(channelIndex, frameData);
    } else {
      // Raw PCM path - ~3840 bytes per frame (960 samples * 4 bytes)
      const channelData = this.bytesToFloat32(frameData);
      return {
        channelIndex,
        channelData,
        samplesDecoded: channelData.length,
        sampleRate: SAMPLE_RATE,
      };
    }
  }

  /**
   * Cleans up all decoder resources and releases WASM memory.
   * @private
   */
  private cleanupDecoders(): void {
    for (const [, decoder] of this.decoders) {
      try {
        decoder.free();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.decoders.clear();
  }

  /**
   * Cleans up all GainNode resources.
   * @private
   */
  private cleanupGainNodes(): void {
    for (const [, gainNode] of this.gainNodes) {
      try {
        gainNode.disconnect();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.gainNodes.clear();
  }

  /**
   * Initializes the Web Audio API playback pipeline.
   * Creates AudioContext at 48kHz and sets up frame scheduling.
   * @private
   */
  private async initAudioPlayback(): Promise<void> {
    // Create AudioContext with 48kHz sample rate (matches Opus decoder output)
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

    this.installAudioUnlockHandlers();

    // Try to resume immediately when connect() was triggered by a user gesture.
    // If the browser blocks autoplay, keep streaming alive and resume on the next gesture.
    await this.tryResumeAudioContext();

    // Start volume level decay timer for VU meter
    this.startLevelDecayTimer();

    // Subscribe to decoded frames and schedule them for playback
    this.decodedFrameSubscription = this._decodedChannelFrame$.subscribe((frame) => {
      this.scheduleFrame(frame);
    });
  }

  /**
   * Schedules a decoded audio frame for gapless playback.
   * Uses AudioBufferSourceNode with time-based scheduling for smooth playback.
   * Implements mono-to-stereo upmix via ChannelMergerNode.
   * @param frame - The decoded channel frame to schedule
   * @private
   */
  private scheduleFrame(frame: DecodedChannelFrame): void {
    if (!this.audioContext) {
      console.warn('[AudioStreamService] AudioContext not initialized');
      return;
    }

    // Chrome may keep the context suspended until a user gesture. Drop frames while
    // suspended so we don't queue an ever-growing backlog that plays late after unlock.
    if (this.audioContext.state !== 'running') {
      return;
    }

    const { channelIndex, channelData, samplesDecoded } = frame;

    if (!channelData || samplesDecoded === 0) {
      return;
    }

    // Compute peak amplitude for per-channel VU meter display
    this.updateChannelVolumeLevel(channelIndex, channelData);

    // Get or create GainNode for this channel
    const gainNode = this.getOrCreateGainNode(channelIndex);
    if (!gainNode) {
      console.warn(`[AudioStreamService] Failed to create GainNode for channel ${channelIndex}`);
      return;
    }

    // Create mono AudioBuffer
    const monoBuffer = this.audioContext.createBuffer(1, samplesDecoded, SAMPLE_RATE);
    monoBuffer.getChannelData(0).set(channelData);

    // Create AudioBufferSourceNode for this frame
    const source = this.audioContext.createBufferSource();
    source.buffer = monoBuffer;

    // Create ChannelMergerNode to upmix mono to stereo (L+R)
    // This ensures audio plays from both speakers
    const merger = this.audioContext.createChannelMerger(2);

    // Connect: mono source output 0 -> merger input 0 (left)
    //          mono source output 0 -> merger input 1 (right)
    source.connect(merger, 0, 0);
    source.connect(merger, 0, 1);

    // Connect merger to GainNode for volume control
    merger.connect(gainNode);

    // Get the next play time for this channel
    let nextPlayTime = this.getNextPlayTime(channelIndex);

    // Get current audio context time
    const now = this.audioContext.currentTime;

    // Target: schedule frames preBufferDuration ahead of real time.
    // If we've fallen behind (nextPlayTime < now), jump ahead to now + catchUpPadding.
    // If we've drifted too far ahead (buffered too much), pull back to the target lead.
    const targetTime = now + this.preBufferDuration;

    if (nextPlayTime < now) {
      // Fallen behind real-time — skip ahead with catch-up padding
      nextPlayTime = now + this.catchUpPadding;
    } else if (nextPlayTime > targetTime + 0.1) {
      // Too far ahead (>100ms past target) — pull back to target lead time.
      // This makes lowering the pre-buffer slider immediately audible.
      nextPlayTime = targetTime;
    }

    // Schedule the frame for gapless playback
    source.start(nextPlayTime);

    // Update next play time for the following frame on this channel
    this.nextPlayTimes.set(channelIndex, nextPlayTime + monoBuffer.duration);

    // Clean up source node after playback completes to prevent memory leaks
    source.onended = () => {
      source.disconnect();
      merger.disconnect();
    };
  }

  /**
   * Computes and updates the volume level for a specific channel.
   * Uses peak amplitude detection for VU meter display.
   * @param channelIndex - The channel index
   * @param samples - Float32Array of PCM samples
   * @private
   */
  private updateChannelVolumeLevel(channelIndex: number, samples: Float32Array): void {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) {
        peak = abs;
      }
    }
    // Clamp to valid range [0, 1]
    const clampedPeak = Math.min(1, peak);

    // Update per-channel volumes
    const currentVolumes = new Map(this._channelVolumes$.getValue());
    currentVolumes.set(channelIndex, clampedPeak);
    this._channelVolumes$.next(currentVolumes);

    // Update aggregate volume level (max of all channels)
    const maxVolume = Math.max(...Array.from(currentVolumes.values()));
    this._volumeLevel$.next(maxVolume);
  }

  /**
   * Starts the volume level decay timer.
   * Gradually reduces the volume level when frames stop arriving.
   * @private
   */
  private startLevelDecayTimer(): void {
    // Clear any existing timer
    if (this.levelDecayTimer !== null) {
      clearInterval(this.levelDecayTimer);
    }

    // Decay the level meter when frames stop arriving
    this.levelDecayTimer = setInterval(() => {
      // Decay per-channel volumes
      const currentVolumes = new Map(this._channelVolumes$.getValue());
      let maxVolume = 0;
      for (const [channel, volume] of currentVolumes) {
        const decayed = volume * 0.85;
        currentVolumes.set(channel, decayed);
        if (decayed > maxVolume) maxVolume = decayed;
      }
      this._channelVolumes$.next(currentVolumes);
      this._volumeLevel$.next(maxVolume);
    }, 80);
  }

  /**
   * Cleans up Web Audio playback resources.
   * Closes AudioContext, clears timers, and disconnects all GainNodes.
   * @private
   */
  private cleanupAudioPlayback(): void {
    if (this.audioUnlockCleanup) {
      this.audioUnlockCleanup();
      this.audioUnlockCleanup = null;
    }

    // Clear level decay timer
    if (this.levelDecayTimer !== null) {
      clearInterval(this.levelDecayTimer);
      this.levelDecayTimer = null;
    }

    // Clean up all GainNodes
    this.cleanupGainNodes();

    // Close AudioContext
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // Ignore errors during cleanup
      }
      this.audioContext = null;
    }

    // Reset volume levels
    this._volumeLevel$.next(0);
    this._channelVolumes$.next(new Map());

    // Reset per-channel timing
    this.nextPlayTimes.clear();
    this.loggedChannelConnectionInfo.clear();
  }

  /**
   * Attempts to resume the AudioContext. Autoplay policy may block this until a user gesture.
   * Returns true when audio is running, false when still blocked/suspended.
   */
  private async tryResumeAudioContext(): Promise<boolean> {
    if (!this.audioContext) return false;

    if (this.audioContext.state === 'running') {
      return true;
    }

    try {
      await this.audioContext.resume();

      // Reset scheduling after unlock so playback starts from "now" without stale timing.
      this.nextPlayTimes.clear();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[AudioStreamService] AudioContext resume blocked: ${message}`);
      return false;
    }
  }

  /**
   * Registers one-time user gesture handlers that resume the AudioContext after autoplay blocking.
   */
  private installAudioUnlockHandlers(): void {
    if (this.audioUnlockCleanup) {
      this.audioUnlockCleanup();
      this.audioUnlockCleanup = null;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handler = () => {
      if (!this.audioContext || this.audioContext.state === 'running') return;
      this.audioContext.resume().then(() => {
        this.nextPlayTimes.clear();
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      }).catch(() => {});
    };

    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart', 'touchend', 'click'];
    for (const eventName of events) {
      document.addEventListener(eventName, handler, { passive: true });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void this.tryResumeAudioContext();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onStateChange = () => {
      if (this.audioContext?.state === 'running') {
        this.audioContext.removeEventListener('statechange', onStateChange);
      }
    };
    this.audioContext?.addEventListener('statechange', onStateChange);

    this.audioUnlockCleanup = () => {
      for (const eventName of events) {
        document.removeEventListener(eventName, handler);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      this.audioContext?.removeEventListener('statechange', onStateChange);
    };
  }

  /**
   * Sets up handlers for automatic reconnection events.
   */
  private setupReconnectionHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting(() => {
      this._streamState$.next(AudioStreamState.Connecting);
    });

    this.hubConnection.onreconnected(() => {
      this._streamState$.next(AudioStreamState.Streaming);
    });

    this.hubConnection.onclose(() => {
      if (this.currentState !== AudioStreamState.Disconnected) {
        this._streamState$.next(AudioStreamState.Error);
      }
    });
  }

  /**
   * Converts incoming SignalR data to Uint8Array.
   * With JSON protocol, byte[] arrives as a base64 string.
   * With MessagePack protocol, byte[] arrives as Uint8Array directly.
   */
  private toUint8Array(chunk: unknown): Uint8Array | null {
    if (chunk instanceof Uint8Array) {
      return chunk;
    }
    if (typeof chunk === 'string') {
      // JSON protocol encodes byte[] as base64
      const binary = atob(chunk);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    return null;
  }

  /**
   * Parses incoming SignalR data as a ChannelAudioFrame.
   * Handles both object format from JSON protocol and binary format.
   * @param chunk - The incoming data from SignalR
   * @returns Parsed ChannelAudioFrame or null if parsing failed
   * @private
   */
  private parseChannelAudioFrame(chunk: unknown): ChannelAudioFrame | null {
    if (typeof chunk === 'object' && chunk !== null) {
      // JSON protocol - object with channelIndex and opusFrame
      const obj = chunk as Record<string, unknown>;
      if ('channelIndex' in obj && 'opusFrame' in obj) {
        const channelIndex = obj['channelIndex'] as number;
        const opusFrameRaw = obj['opusFrame'];
        const opusFrame = this.toUint8Array(opusFrameRaw);
        if (opusFrame !== null) {
          return { channelIndex, opusFrame };
        }
      }

      // Backward compatibility: raw Uint8Array (treat as channel 0)
      if (chunk instanceof Uint8Array) {
        return { channelIndex: 0, opusFrame: chunk };
      }
    }
    return null;
  }

  /**
   * Starts audio capture and subscribes to the audio stream for the specified device.
   * Calls StartCapture on the hub to begin capturing from the device's saved audio settings,
   * then subscribes to the StreamAudio stream to receive ChannelAudioFrame records.
   * @param deviceId - The TeensyROM device identifier
   */
  private async subscribeToStream(deviceId: string): Promise<void> {
    if (!this.hubConnection) {
      throw new Error('Hub connection not established');
    }

    if (!deviceId || deviceId.trim().length === 0) {
      throw new Error('Device ID is required');
    }

    this.activeDeviceId = deviceId;
    logInfo(LogType.Info, 'AudioStream: Starting capture subscription', {
      deviceId,
      codec: this.useOpusEncoding ? 'opus' : 'raw-pcm',
    });

    // Start audio capture on the server (uses saved audio settings for this device)
    await this.hubConnection.invoke('StartCapture', deviceId);

    // Subscribe to the encoded audio stream (now returns ChannelAudioFrame)
    const stream = this.hubConnection.stream<ChannelAudioFrame>('StreamAudio', deviceId);

    this.streamSubscription = stream.subscribe({
      next: (chunk: unknown) => {
        const frame = this.parseChannelAudioFrame(chunk);
        if (frame) {
          if (!this.loggedChannelConnectionInfo.has(frame.channelIndex)) {
            this.loggedChannelConnectionInfo.add(frame.channelIndex);
            logInfo(LogType.Info, 'AudioStream: First channel frame received', {
              deviceId,
              channelIndex: frame.channelIndex,
              codec: this.useOpusEncoding ? 'opus' : 'raw-pcm',
              payloadBytes: frame.opusFrame.length,
            });
          }

          // Process the frame (decode Opus or convert raw PCM based on setting)
          this.processFrame(frame.channelIndex, frame.opusFrame).then((decoded) => {
            if (decoded) {
              this._decodedChannelFrame$.next(decoded);
            }
          });
        } else {
          console.warn(
            '[AudioStreamService] Unexpected chunk type:',
            typeof chunk
          );
        }
      },
      error: (error: Error) => {
        console.error('[AudioStreamService] Stream error:', error);
        this._streamState$.next(AudioStreamState.Error);
      },
      complete: () => {
        console.debug('[AudioStreamService] Stream complete');
        if (this.currentState === AudioStreamState.Streaming) {
          this._streamState$.next(AudioStreamState.Disconnected);
        }
      },
    });
  }

  /**
   * Cleanup on destroy.
   */
  ngOnDestroy(): void {
    this.disconnect();
  }
}
