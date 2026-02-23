namespace TeensyRom.Core.Audio;

/// <summary>
/// Static utility for separating interleaved multi-channel PCM audio into individual mono channel arrays.
/// PortAudio delivers audio as interleaved samples (L0, R0, L1, R1, ...); this utility splits them
/// into separate arrays per channel for independent Opus encoding.
/// </summary>
public static class ChannelDeinterleaver
{
    /// <summary>
    /// Separates interleaved PCM float samples into individual mono channel arrays.
    /// </summary>
    /// <param name="interleaved">
    /// Interleaved PCM samples where samples alternate by channel.
    /// For 2-channel stereo: [L0, R0, L1, R1, L2, R2, ...]
    /// </param>
    /// <param name="channelCount">
    /// The number of channels in the interleaved data (e.g., 1 for mono, 2 for stereo, 4 for quad).
    /// </param>
    /// <returns>
    /// An array of float arrays, one per channel.
    /// result[0] contains all channel 0 samples, result[1] contains all channel 1 samples, etc.
    /// Returns empty arrays if input is empty.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// Thrown when channelCount is less than 1.
    /// </exception>
    /// <exception cref="ArgumentException">
    /// Thrown when interleaved length is not evenly divisible by channelCount.
    /// </exception>
    public static float[][] Deinterleave(float[] interleaved, int channelCount)
    {
        if (channelCount < 1)
            throw new ArgumentOutOfRangeException(nameof(channelCount), "Channel count must be at least 1.");

        if (interleaved.Length == 0)
        {
            // Return empty arrays for each channel
            var emptyResult = new float[channelCount][];
            for (int i = 0; i < channelCount; i++)
                emptyResult[i] = [];
            return emptyResult;
        }

        if (interleaved.Length % channelCount != 0)
            throw new ArgumentException(
                $"Interleaved data length ({interleaved.Length}) must be evenly divisible by channel count ({channelCount}).",
                nameof(interleaved));

        var samplesPerChannel = interleaved.Length / channelCount;
        var result = new float[channelCount][];

        // Initialize result arrays
        for (int ch = 0; ch < channelCount; ch++)
            result[ch] = new float[samplesPerChannel];

        // Deinterleave: for each sample position, extract each channel's sample
        for (int i = 0; i < interleaved.Length; i++)
        {
            var channel = i % channelCount;
            var sampleIndex = i / channelCount;
            result[channel][sampleIndex] = interleaved[i];
        }

        return result;
    }

    /// <summary>
    /// Extracts a single channel from interleaved PCM float samples.
    /// </summary>
    /// <param name="interleaved">Interleaved PCM samples.</param>
    /// <param name="channelCount">Total number of channels in the interleaved data.</param>
    /// <param name="channelToExtract">The 0-based index of the channel to extract.</param>
    /// <returns>A mono float array containing only the specified channel's samples.</returns>
    public static float[] ExtractChannel(float[] interleaved, int channelCount, int channelToExtract)
    {
        if (channelCount < 1)
            throw new ArgumentOutOfRangeException(nameof(channelCount), "Channel count must be at least 1.");
        if (channelToExtract < 0 || channelToExtract >= channelCount)
            throw new ArgumentOutOfRangeException(nameof(channelToExtract),
                $"Channel to extract ({channelToExtract}) must be between 0 and {channelCount - 1}.");
        if (interleaved.Length == 0)
            return [];

        var samplesPerChannel = interleaved.Length / channelCount;
        var result = new float[samplesPerChannel];

        for (int i = 0; i < samplesPerChannel; i++)
            result[i] = interleaved[i * channelCount + channelToExtract];

        return result;
    }
}
