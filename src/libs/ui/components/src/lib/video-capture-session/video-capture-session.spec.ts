import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoCaptureSession } from './video-capture-session';

function createStream() {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  return { stream, stop };
}

function mockMediaDevices(devices: { deviceId: string; label: string }[]) {
  const enumerateDevices = vi.fn().mockResolvedValue(
    devices.map((d) => ({
      deviceId: d.deviceId,
      label: d.label,
      kind: 'videoinput' as MediaDeviceKind,
      groupId: '',
      toJSON: () => ({}),
    }))
  );
  const streams: ReturnType<typeof createStream>[] = [];
  const getUserMedia = vi.fn().mockImplementation(() => {
    const created = createStream();
    streams.push(created);
    return Promise.resolve(created.stream);
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { enumerateDevices, getUserMedia },
    configurable: true,
  });
  return { enumerateDevices, getUserMedia, streams };
}

describe('VideoCaptureSession', () => {
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  let session: VideoCaptureSession;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [VideoCaptureSession] });
    session = TestBed.inject(VideoCaptureSession);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    } else {
      delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
    }
  });

  it('asks permission, stops that probe stream, lists video inputs and labels unnamed ones', async () => {
    const { getUserMedia, streams } = mockMediaDevices([
      { deviceId: 'cam-a', label: 'Capture A' },
      { deviceId: '1234567890abcdef', label: '' },
    ]);

    await session.start(() => '');

    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
    expect(streams[0].stop).toHaveBeenCalled();
    expect(session.devices()).toEqual([
      { deviceId: 'cam-a', label: 'Capture A' },
      { deviceId: '1234567890abcdef', label: 'Camera 12345678' },
    ]);
    expect(session.hasDevices()).toBe(true);
    expect(session.hasEnumerated()).toBe(true);
  });

  it('prefers the stored camera when present and opens it after 100 ms', async () => {
    const { getUserMedia } = mockMediaDevices([
      { deviceId: 'cam-a', label: 'A' },
      { deviceId: 'cam-b', label: 'B' },
    ]);

    await session.start(() => 'cam-b');

    expect(session.selectedDeviceId()).toBe('cam-b');
    expect(session.stream()).toBeNull();
    await vi.advanceTimersByTimeAsync(100);

    expect(getUserMedia).toHaveBeenLastCalledWith({ video: { deviceId: { exact: 'cam-b' } }, audio: false });
    expect(session.stream()).not.toBeNull();
  });

  it('falls back to the first camera when the stored one is missing', async () => {
    mockMediaDevices([
      { deviceId: 'cam-a', label: 'A' },
      { deviceId: 'cam-b', label: 'B' },
    ]);

    await session.start(() => 'gone');

    expect(session.selectedDeviceId()).toBe('cam-a');
  });

  it('reports enumeration with no cameras found', async () => {
    mockMediaDevices([]);

    await session.start(() => '');

    expect(session.hasEnumerated()).toBe(true);
    expect(session.hasDevices()).toBe(false);
    expect(session.selectedDeviceId()).toBeNull();
  });

  it('sets permissionDenied on NotAllowedError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getUserMedia } = mockMediaDevices([]);
    getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));

    await session.start(() => '');

    expect(session.permissionDenied()).toBe(true);
    expect(session.hasEnumerated()).toBe(false);
  });

  it('logs and returns when the MediaDevices API is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });

    await session.start(() => '');

    expect(errorSpy).toHaveBeenCalledWith('MediaDevices API not available');
    expect(session.hasEnumerated()).toBe(false);
  });

  it('select sets selectedDeviceId before it resolves and stops the previous stream', async () => {
    const { streams } = mockMediaDevices([{ deviceId: 'cam-a', label: 'A' }]);
    await session.select('cam-a');
    const first = streams[0];

    const pending = session.select('cam-b');
    expect(session.selectedDeviceId()).toBe('cam-b');
    await pending;

    expect(first.stop).toHaveBeenCalled();
    expect(session.stream()).toBe(streams[1].stream);
  });

  it('start stops a stream it already holds', async () => {
    const { streams } = mockMediaDevices([{ deviceId: 'cam-a', label: 'A' }]);
    await session.select('cam-a');
    const held = streams[0];

    await session.start(() => '');

    expect(held.stop).toHaveBeenCalled();
  });

  it('ngOnDestroy stops the stream and cancels a pending open', async () => {
    const { getUserMedia, streams } = mockMediaDevices([{ deviceId: 'cam-a', label: 'A' }]);
    await session.select('cam-a');
    const held = streams[0];

    await session.start(() => '');
    session.ngOnDestroy();
    await vi.advanceTimersByTimeAsync(100);

    expect(held.stop).toHaveBeenCalled();
    // the select and start's permission probe; the pending open never fires
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('stop stops the stream and clears it', async () => {
    const { streams } = mockMediaDevices([{ deviceId: 'cam-a', label: 'A' }]);
    await session.select('cam-a');

    session.stop();

    expect(streams[0].stop).toHaveBeenCalled();
    expect(session.stream()).toBeNull();
  });

  it('stop during a pending select discards the late stream and stops its tracks', async () => {
    const { getUserMedia, streams } = mockMediaDevices([{ deviceId: 'cam-a', label: 'A' }]);
    const pending = session.select('cam-a');

    session.stop();
    await pending;

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(streams[0].stop).toHaveBeenCalled();
    expect(session.stream()).toBeNull();
  });

  it('stop during start enumeration keeps the session stopped', async () => {
    const { getUserMedia, streams } = mockMediaDevices([{ deviceId: 'cam-a', label: 'A' }]);
    const pending = session.start(() => '');

    session.stop();
    await pending;
    await vi.advanceTimersByTimeAsync(100);

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(streams[0].stop).toHaveBeenCalled();
    expect(session.stream()).toBeNull();
    expect(session.hasEnumerated()).toBe(false);
  });

  it('a newer select supersedes one still pending', async () => {
    const { streams } = mockMediaDevices([]);
    const first = session.select('cam-a');
    const second = session.select('cam-b');
    await Promise.all([first, second]);

    expect(streams[0].stop).toHaveBeenCalled();
    expect(session.stream()).toBe(streams[1].stream);
  });
});
