import type { PlainValue } from '@sidablist/tunes';
import { StorageType } from '@teensyrom-nx/domain';
import { logWarn } from '@teensyrom-nx/utils';
import type { LoadSource } from '../load-source';

const ROW_HOST_VERSION = 1;

/** What a set row keeps of where its file was found and what the listing said about its length:
 *  the library stores it as the row's opaque host value and never reads it. */
export interface RowHost {
  readonly source: Pick<LoadSource, 'deviceId' | 'storageType' | 'path' | 'fileName'>;
  /** Each subtune's HVSC length in order; '' unknown. */
  readonly lengths: readonly string[];
  /** The tune's HVSC length; '' unknown. */
  readonly playLength: string;
}

/** The row's host value for a file found through `source`. */
export function encodeRowHost(input: {
  source: LoadSource;
  lengths: readonly string[];
  playLength: string;
}): PlainValue {
  const { deviceId, storageType, path, fileName } = input.source;
  return {
    v: ROW_HOST_VERSION,
    source: { deviceId, storageType, path, fileName },
    lengths: [...input.lengths],
    playLength: input.playLength,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStorageType(value: unknown): value is StorageType {
  return Object.values(StorageType).includes(value as StorageType);
}

/** The row's host value, or null: silently when the row keeps none, with one warning when it is of
 *  another version or malformed. */
export function decodeRowHost(value: PlainValue | undefined): RowHost | null {
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    logWarn('RowHost: malformed value');
    return null;
  }
  if (value['v'] !== ROW_HOST_VERSION) {
    logWarn(`RowHost: unsupported version ${String(value['v'])}`);
    return null;
  }

  const { source, lengths, playLength } = value;
  if (
    !isRecord(source) ||
    typeof source['deviceId'] !== 'string' ||
    !isStorageType(source['storageType']) ||
    typeof source['path'] !== 'string' ||
    typeof source['fileName'] !== 'string' ||
    !Array.isArray(lengths) ||
    !lengths.every((length): length is string => typeof length === 'string') ||
    typeof playLength !== 'string'
  ) {
    logWarn('RowHost: malformed value');
    return null;
  }

  return {
    source: {
      deviceId: source['deviceId'],
      storageType: source['storageType'],
      path: source['path'],
      fileName: source['fileName'],
    },
    lengths: [...lengths],
    playLength,
  };
}

const MINUTES_SECONDS = /^(\d+):([0-5]\d)(?:\.\d+)?$/;
const HOURS_MINUTES_SECONDS = /^(\d+):([0-5]\d):([0-5]\d)(?:\.\d+)?$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** A listing length as `mm:ss`: `m:ss` or `mm:ss`, with or without `.fff`, or `h:mm:ss` (minutes
 *  then run past 59). Anything else is `—`. */
export function formatListingLength(raw: string): string {
  const text = raw.trim();

  const short = MINUTES_SECONDS.exec(text);
  if (short !== null) {
    return `${pad(Number(short[1]))}:${short[2]}`;
  }

  const long = HOURS_MINUTES_SECONDS.exec(text);
  if (long !== null) {
    return `${pad(Number(long[1]) * 60 + Number(long[2]))}:${long[3]}`;
  }

  return '—';
}
