/**
 * Audio input device available on the host system
 */
export interface AudioDevice {
  /** Device index for selecting the device for capture */
  index: number;
  /** Human-readable device name */
  name: string;
  /** Maximum number of input channels the device supports */
  maxInputChannels: number;
  /** The device's default/preferred sample rate */
  defaultSampleRate: number;
}
