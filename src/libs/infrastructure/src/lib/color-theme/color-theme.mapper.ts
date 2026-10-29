import {
  DeviceThemePartDto,
  DeviceThemeRecordDto,
  ThemeDto,
} from '@teensyrom-nx/data-access/api-client';
import {
  ColorTheme,
  ColorThemeKind,
  DeviceColorRecord,
  DeviceColors,
} from '@teensyrom-nx/domain';

/** Maps the generated themes API models to and from the color-theme domain models. */
export class ColorThemeMapper {
  static toDeviceColors(dto: DeviceThemePartDto): DeviceColors {
    return {
      background: dto.background,
      border: dto.border,
      banner: dto.banner,
      time: dto.time,
      option: dto.option,
      sources: dto.sources,
      name: dto.name,
    };
  }

  static toDeviceThemePartDto(colors: DeviceColors): DeviceThemePartDto {
    return {
      background: colors.background,
      border: colors.border,
      banner: colors.banner,
      time: colors.time,
      option: colors.option,
      sources: colors.sources,
      name: colors.name,
    };
  }

  static toColorTheme(dto: ThemeDto): ColorTheme {
    return {
      id: dto.id,
      name: dto.name,
      kind: dto.kind === 'Custom' ? ColorThemeKind.Custom : ColorThemeKind.Shipped,
      parts: { device: ColorThemeMapper.toDeviceColors(dto.parts.device) },
    };
  }

  static toDeviceColorRecord(dto: DeviceThemeRecordDto): DeviceColorRecord {
    return {
      deviceId: dto.deviceId,
      colors: ColorThemeMapper.toDeviceColors(dto.colors),
      themeId: dto.themeId ?? null,
      appliedAt: dto.appliedAt ? dto.appliedAt.toISOString() : null,
      isRecorded: dto.isRecorded,
    };
  }
}
