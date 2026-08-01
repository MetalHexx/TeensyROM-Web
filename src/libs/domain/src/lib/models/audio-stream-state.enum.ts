/**
 * Audio stream connection states
 */
export enum AudioStreamState {
  /** Not connected to any audio stream */
  Disconnected = 'disconnected',
  /** Attempting to connect to audio stream */
  Connecting = 'connecting',
  /** Actively streaming audio */
  Streaming = 'streaming',
  /** Error occurred during streaming */
  Error = 'error',
}
