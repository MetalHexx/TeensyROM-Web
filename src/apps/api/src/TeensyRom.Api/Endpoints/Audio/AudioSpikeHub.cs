using Microsoft.AspNetCore.SignalR;
using PortAudioSharp;
using System.Runtime.CompilerServices;

namespace TeensyRom.Api.Endpoints.Audio;

/// <summary>
/// SPIKE ONLY — validates PortAudio capture + SignalR binary streaming viability.
/// Delete or gate behind feature flag before any production use.
/// </summary>
public sealed class AudioSpikeHub : Hub
{
    // ── Device enumeration ────────────────────────────────────────────────
    public record AudioDeviceRecord(int Index, string Name, int MaxInputChannels, double DefaultSampleRate);

    public IEnumerable<AudioDeviceRecord> GetDevices()
    {
        PortAudio.Initialize();
        var count = PortAudio.DeviceCount;
        var devices = new List<AudioDeviceRecord>();

        for (int i = 0; i < count; i++)
        {
            var info = PortAudio.GetDeviceInfo(i);
            if (info.maxInputChannels > 0)
                devices.Add(new AudioDeviceRecord(i, info.name, info.maxInputChannels, info.defaultSampleRate));
        }

        return devices;
    }

    // ── Audio streaming ──────────────────────────────────────────────────
    private const int SampleRate = 48000;
    private const int FramesPerBuffer = 960; // 20ms @ 48kHz

    public async IAsyncEnumerable<byte[]> StreamAudio(
        int deviceIndex,
        int channels,
        [EnumeratorCancellation] CancellationToken ct)
    {
        PortAudio.Initialize();

        var queue = new System.Collections.Concurrent.ConcurrentQueue<byte[]>();
        var tcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        StreamCallbackResult Callback(
            nint input, nint output, uint frameCount,
            ref StreamCallbackTimeInfo timeInfo,
            StreamCallbackFlags flags, nint userData)
        {
            if (ct.IsCancellationRequested)
                return StreamCallbackResult.Abort;

            // Each float is 4 bytes; copy the raw PCM bytes into queue
            var byteCount = (int)frameCount * channels * sizeof(float);
            var buffer = new byte[byteCount];
            System.Runtime.InteropServices.Marshal.Copy(input, buffer, 0, byteCount);
            queue.Enqueue(buffer);
            tcs.TrySetResult();
            return StreamCallbackResult.Continue;
        }

        var streamParams = new StreamParameters
        {
            device = deviceIndex,
            channelCount = channels,
            sampleFormat = SampleFormat.Float32,
            suggestedLatency = PortAudio.GetDeviceInfo(deviceIndex).defaultLowInputLatency,
        };

        using var stream = new PortAudioSharp.Stream(
            inParams: streamParams,
            outParams: null,
            sampleRate: SampleRate,
            framesPerBuffer: (uint)FramesPerBuffer,
            streamFlags: StreamFlags.ClipOff,
            callback: Callback,
            userData: nint.Zero);

        stream.Start();

        try
        {
            while (!ct.IsCancellationRequested)
            {
                tcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                await tcs.Task.WaitAsync(TimeSpan.FromSeconds(2), ct);

                while (queue.TryDequeue(out var chunk))
                    yield return chunk;
            }
        }
        finally
        {
            stream.Stop();
        }
    }
}
