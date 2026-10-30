import type {
  DeckDeviceBindingDto,
  GetMidiSettingsResponse,
  KnownMidiControllerDto,
  MidiControlMappingDto,
  SaveMidiSettingsRequest,
} from '@teensyrom-nx/data-access/api-client';
import type {
  ControlMappingRecord,
  DeckDeviceBindingRecord,
  KnownControllerRecord,
  MappingStyleKind,
  MidiSettingsRecord,
  Slot,
} from '@teensyrom-nx/application';

export function toMidiSettingsRecord(dto: GetMidiSettingsResponse): MidiSettingsRecord {
  return {
    controllers: dto.controllers.map(toControllerRecord),
    mappings: dto.mappings.map(toMappingRecord),
    deckBindings: dto.deckBindings.map(toDeckBindingRecord),
  };
}

export function toSaveMidiSettingsRequest(record: MidiSettingsRecord): SaveMidiSettingsRequest {
  return {
    controllers: record.controllers.map(toControllerDto),
    mappings: record.mappings.map(toMappingDto),
    deckBindings: record.deckBindings.map(toDeckBindingDto),
  };
}

function toControllerRecord(dto: KnownMidiControllerDto): KnownControllerRecord {
  return {
    id: dto.id,
    name: dto.name,
    lastPortId: dto.lastPortId ?? null,
    listening: dto.listening,
  };
}

function toMappingRecord(dto: MidiControlMappingDto): ControlMappingRecord {
  return {
    id: dto.id,
    source: {
      controllerId: dto.source.controllerId,
      channel: dto.source.channel,
      kind: dto.source.kind as ControlMappingRecord['source']['kind'],
      number: dto.source.number,
    },
    owner: dto.owner as ControlMappingRecord['owner'],
    control: dto.control,
    style: {
      kind: dto.style.kind as MappingStyleKind,
      amount: dto.style.amount ?? null,
      ...(dto.style.grip == null ? {} : { grip: dto.style.grip }),
    },
  };
}

function toDeckBindingRecord(dto: DeckDeviceBindingDto): DeckDeviceBindingRecord {
  return {
    slot: dto.slot as Slot,
    deviceId: dto.deviceId,
    lastSeenName: dto.lastSeenName,
  };
}

function toControllerDto(record: KnownControllerRecord): KnownMidiControllerDto {
  return {
    id: record.id,
    name: record.name,
    lastPortId: record.lastPortId,
    listening: record.listening,
  };
}

function toMappingDto(record: ControlMappingRecord): MidiControlMappingDto {
  return {
    id: record.id,
    source: { ...record.source },
    owner: record.owner,
    control: record.control,
    style: {
      kind: record.style.kind,
      amount: record.style.amount,
      grip: record.style.grip ?? null,
    },
  };
}

function toDeckBindingDto(record: DeckDeviceBindingRecord): DeckDeviceBindingDto {
  return { slot: record.slot, deviceId: record.deviceId, lastSeenName: record.lastSeenName };
}
