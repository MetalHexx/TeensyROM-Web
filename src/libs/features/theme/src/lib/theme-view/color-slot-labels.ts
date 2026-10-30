import { DeviceColors } from '@teensyrom-nx/domain';

export interface ColorSlotLabel {
  label: string;
  description: string;
}

/** Display label and description of each device color slot. */
export const COLOR_SLOT_LABELS: Record<keyof DeviceColors, ColorSlotLabel> = {
  background: { label: 'Background', description: 'Screen background' },
  border: { label: 'Border', description: 'Screen border' },
  banner: { label: 'Banner', description: 'Top-of-screen banner' },
  time: { label: 'Time', description: 'Time display and waiting message' },
  option: { label: 'Option', description: 'Input key option indication' },
  sources: { label: 'Sources', description: 'General text and descriptions' },
  name: { label: 'Name', description: 'File names and other text' },
};
