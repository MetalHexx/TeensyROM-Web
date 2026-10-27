import { describe, it, expect } from 'vitest';
import {
  TransferJobDto,
  TransferJobDto2,
  TransferJobState as ApiTransferJobState,
  TransferLaunchState,
  TransferOriginKind,
  TeensyStorageType,
} from '@teensyrom-nx/data-access/api-client';
import {
  StorageType,
  TransferJobState,
  TransferLaunchState as DomainLaunchState,
  TransferOriginKind as DomainOriginKind,
} from '@teensyrom-nx/domain';
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
    origin: { kind: TransferOriginKind.Upload },
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
    launchState: TransferLaunchState.None,
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
      bytesSent: 4096,
      totalFiles: 5,
      currentFile: 'game.prg',
      origin: { kind: DomainOriginKind.Upload, watchFolderId: null, watchFolderPath: null },
      startedUtc: baseFields.startedUtc,
      lastActivityUtc: baseFields.lastActivityUtc,
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
      launchState: DomainLaunchState.None,
      launchedPath: null,
      launchError: null,
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

  it('coerces a raw ISO string lastActivityUtc into a Date', () => {
    const dto = {
      ...baseFields,
      lastActivityUtc: '2026-01-01T00:01:00.000Z',
    } as unknown as TransferJobDto;

    expect(TransferDtoMapper.toSnapshot(dto).lastActivityUtc).toEqual(
      new Date('2026-01-01T00:01:00.000Z')
    );
  });

  it('maps a watch-folder origin with its folder id and path', () => {
    const dto: TransferJobDto = {
      ...baseFields,
      origin: {
        kind: TransferOriginKind.WatchFolder,
        watchFolderId: 'wf-1',
        watchFolderPath: 'C:/roms/incoming',
      },
    };

    expect(TransferDtoMapper.toSnapshot(dto).origin).toEqual({
      kind: DomainOriginKind.WatchFolder,
      watchFolderId: 'wf-1',
      watchFolderPath: 'C:/roms/incoming',
    });
  });

  it('maps every generated launch state and the launched path and error', () => {
    const states: Array<[TransferLaunchState, DomainLaunchState]> = [
      [TransferLaunchState.None, DomainLaunchState.None],
      [TransferLaunchState.Pending, DomainLaunchState.Pending],
      [TransferLaunchState.Launched, DomainLaunchState.Launched],
      [TransferLaunchState.Incompatible, DomainLaunchState.Incompatible],
      [TransferLaunchState.Failed, DomainLaunchState.Failed],
    ];

    for (const [apiState, domainState] of states) {
      const dto: TransferJobDto = {
        ...baseFields,
        launchState: apiState,
        launchedPath: '/games/a.prg',
        launchError: 'boom',
      };
      const snapshot = TransferDtoMapper.toSnapshot(dto);
      expect(snapshot.launchState).toBe(domainState);
      expect(snapshot.launchedPath).toBe('/games/a.prg');
      expect(snapshot.launchError).toBe('boom');
    }
  });

  it('throws on an origin kind or launch state the domain does not recognize', () => {
    expect(() =>
      TransferDtoMapper.toSnapshot({
        ...baseFields,
        origin: { kind: 'Mystery' as TransferOriginKind },
      })
    ).toThrow('Unknown API transfer origin kind');
    expect(() =>
      TransferDtoMapper.toSnapshot({
        ...baseFields,
        launchState: 'Mystery' as TransferLaunchState,
      })
    ).toThrow('Unknown API transfer launch state');
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
      [ApiTransferJobState.Cancelled, TransferJobState.Cancelled],
      [ApiTransferJobState.Abandoned, TransferJobState.Abandoned],
      [ApiTransferJobState.Aborted, TransferJobState.Aborted],
    ];

    for (const [apiState, domainState] of states) {
      const dto: TransferJobDto = { ...baseFields, state: apiState };
      expect(TransferDtoMapper.toSnapshot(dto).state).toBe(domainState);
    }
  });

  it('throws on a job state the domain does not recognize', () => {
    const dto: TransferJobDto = {
      ...baseFields,
      state: 'Cancelling' as ApiTransferJobState,
    };

    expect(() => TransferDtoMapper.toSnapshot(dto)).toThrow('Unknown API transfer job state');
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
