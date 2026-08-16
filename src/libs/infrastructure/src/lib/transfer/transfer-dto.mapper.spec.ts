import { describe, it, expect } from 'vitest';
import {
  TransferJobDto,
  TransferJobDto2,
  TransferJobState as ApiTransferJobState,
  TeensyStorageType,
} from '@teensyrom-nx/data-access/api-client';
import { StorageType, TransferJobState } from '@teensyrom-nx/domain';
import { TransferDtoMapper } from './transfer-dto.mapper';

describe('TransferDtoMapper', () => {
  const baseFields = {
    jobId: 'job-1',
    deviceId: 'device-1',
    storageType: TeensyStorageType.Sd,
    destinationDirectory: '/games/',
    state: ApiTransferJobState.Receiving,
    filesReceived: 2,
    filesSent: 3,
    filesFailed: 1,
    bytesSent: 4096,
    totalFiles: 5,
    currentFile: 'game.prg',
    startedUtc: new Date('2026-01-01T00:00:00Z'),
    lastActivityUtc: new Date('2026-01-01T00:01:00Z'),
    error: 'partial failure',
    failures: [
      {
        jobId: 'job-1',
        relativePath: 'games/bad.prg',
        targetPath: '/games/bad.prg',
        success: false,
        error: 'disk full',
        sizeBytes: 100,
      },
    ],
    recentCompletions: [
      {
        jobId: 'job-1',
        relativePath: 'games/good.prg',
        targetPath: '/games/good.prg',
        success: true,
        error: null,
        sizeBytes: 200,
      },
    ],
    bytesPerSecond: 1024,
    filesPerSecond: 2.5,
    expandingArchive: 'roms/archive.zip',
    expansionBytesWritten: 512000,
    expansionBytesDeclared: 1024000,
    expandedFileCount: 42,
  };

  it('normalizes TransferJobDto (create/seal/cancel envelope) into the domain snapshot', () => {
    const dto: TransferJobDto = { ...baseFields };

    const snapshot = TransferDtoMapper.toSnapshot(dto);

    expect(snapshot).toEqual({
      jobId: 'job-1',
      deviceId: 'device-1',
      storageType: StorageType.Sd,
      destinationDirectory: '/games/',
      state: TransferJobState.Receiving,
      filesReceived: 2,
      filesSent: 3,
      filesFailed: 1,
      totalFiles: 5,
      currentFile: 'game.prg',
      startedUtc: baseFields.startedUtc,
      error: 'partial failure',
      failures: [
        {
          jobId: 'job-1',
          relativePath: 'games/bad.prg',
          targetPath: '/games/bad.prg',
          success: false,
          error: 'disk full',
          sizeBytes: 100,
        },
      ],
      recentCompletions: [
        {
          jobId: 'job-1',
          relativePath: 'games/good.prg',
          targetPath: '/games/good.prg',
          success: true,
          error: null,
          sizeBytes: 200,
        },
      ],
      bytesPerSecond: 1024,
      filesPerSecond: 2.5,
      expandingArchive: 'roms/archive.zip',
      expansionBytesWritten: 512000,
      expansionBytesDeclared: 1024000,
      expandedFileCount: 42,
    });
  });

  it('normalizes the bare TransferJobDto2 (hub push / active-job envelope) to the identical snapshot', () => {
    const dto2: TransferJobDto2 = { ...baseFields };
    const dto1: TransferJobDto = { ...baseFields };

    expect(TransferDtoMapper.toSnapshot(dto2)).toEqual(TransferDtoMapper.toSnapshot(dto1));
  });

  it('defaults optional totalFiles/currentFile/error to null when absent', () => {
    const dto: TransferJobDto = {
      ...baseFields,
      totalFiles: undefined,
      currentFile: undefined,
      error: undefined,
      failures: [],
    };

    const snapshot = TransferDtoMapper.toSnapshot(dto);

    expect(snapshot.totalFiles).toBeNull();
    expect(snapshot.currentFile).toBeNull();
    expect(snapshot.error).toBeNull();
    expect(snapshot.failures).toEqual([]);
  });

  it('coerces a raw ISO string startedUtc into a Date (SignalR pushes skip the REST fromJSON deserializer)', () => {
    const dto = {
      ...baseFields,
      startedUtc: '2026-01-01T00:00:00.000Z',
    } as unknown as TransferJobDto;

    const snapshot = TransferDtoMapper.toSnapshot(dto);

    expect(snapshot.startedUtc).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(snapshot.startedUtc.getTime()).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
  });

  it('maps USB storage type', () => {
    const dto: TransferJobDto = { ...baseFields, storageType: TeensyStorageType.Usb };

    expect(TransferDtoMapper.toSnapshot(dto).storageType).toBe(StorageType.Usb);
  });

  it('maps every generated job state to its domain equivalent', () => {
    const states: Array<[ApiTransferJobState, TransferJobState]> = [
      [ApiTransferJobState.Created, TransferJobState.Created],
      [ApiTransferJobState.Receiving, TransferJobState.Receiving],
      [ApiTransferJobState.Sealed, TransferJobState.Sealed],
      [ApiTransferJobState.Completed, TransferJobState.Completed],
      [ApiTransferJobState.Cancelling, TransferJobState.Cancelling],
      [ApiTransferJobState.Cancelled, TransferJobState.Cancelled],
      [ApiTransferJobState.Abandoned, TransferJobState.Abandoned],
      [ApiTransferJobState.Aborted, TransferJobState.Aborted],
    ];

    for (const [apiState, domainState] of states) {
      const dto: TransferJobDto = { ...baseFields, state: apiState };
      expect(TransferDtoMapper.toSnapshot(dto).state).toBe(domainState);
    }
  });

  it('defaults expandingArchive and expandedFileCount to null when absent', () => {
    const dto: TransferJobDto = {
      ...baseFields,
      expandingArchive: undefined,
      expandedFileCount: undefined,
    };

    const snapshot = TransferDtoMapper.toSnapshot(dto);

    expect(snapshot.expandingArchive).toBeNull();
    expect(snapshot.expandedFileCount).toBeNull();
    expect(snapshot.expansionBytesWritten).toBe(512000);
    expect(snapshot.expansionBytesDeclared).toBe(1024000);
  });
});
