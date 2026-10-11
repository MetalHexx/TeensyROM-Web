/** Machine the TeensyROM is plugged into. Values match the API's JSON strings. */
export enum DeviceMachine {
  Unknown = 'Unknown',
  C64 = 'C64',
  C128 = 'C128',
}

/** Video standard the host machine runs at. Values match the API's JSON strings. */
export enum DeviceVideoStandard {
  Unknown = 'Unknown',
  Ntsc = 'NTSC',
  Pal = 'PAL',
}

/** Cartridge hardware revision. Values match the API's JSON strings. */
export enum DeviceHardwareVariant {
  Unknown = 'Unknown',
  TeensyRom = 'TeensyRom',
  TeensyRomPlus = 'TeensyRomPlus',
}
