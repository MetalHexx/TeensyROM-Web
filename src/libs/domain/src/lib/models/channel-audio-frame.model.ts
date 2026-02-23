/**
 * Represents a single Opus-encoded audio frame tagged with its source channel index.
 * Used for multi-channel streaming where each channel is independently encoded.
 */
export interface ChannelAudioFrame {
  /** The 0-based index of the source channel this frame belongs to */
  channelIndex: number;
  /** The Opus-encoded audio data for this channel (mono) */
  opusFrame: Uint8Array;
}
