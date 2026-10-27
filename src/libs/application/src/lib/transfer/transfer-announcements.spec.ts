import { describe, it, expect } from 'vitest';
import {
  StorageType,
  TransferJobSnapshot,
  TransferJobState,
  TransferLaunchState,
  TransferOriginKind,
} from '@teensyrom-nx/domain';
import { buildEndAnnouncement, buildStartAnnouncement } from './transfer-announcements';

const createSnapshot = (overrides: Partial<TransferJobSnapshot> = {}): TransferJobSnapshot => ({
  jobId: 'job-1',
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  destinationDirectory: '/games/',
  state: TransferJobState.Receiving,
  filesReceived: 0,
  filesSent: 0,
  filesFailed: 0,
  bytesSent: 0,
  totalFiles: null,
  currentFile: null,
  origin: { kind: TransferOriginKind.Upload, watchFolderId: null, watchFolderPath: null },
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  lastActivityUtc: new Date('2026-01-01T00:00:00Z'),
  error: null,
  failures: [],
  recentCompletions: [],
  bytesPerSecond: 0,
  filesPerSecond: 0,
  expandingArchive: null,
  expansionBytesWritten: 0,
  expansionBytesDeclared: 0,
  expandedFileCount: null,
  launchState: TransferLaunchState.None,
  launchedPath: null,
  launchError: null,
  ...overrides,
});

const watchFolder = {
  kind: TransferOriginKind.WatchFolder,
  watchFolderId: 'wf-1',
  watchFolderPath: 'C:\\roms\\incoming',
};

describe('buildStartAnnouncement', () => {
  it('names the count and device for an upload', () => {
    expect(buildStartAnnouncement(createSnapshot({ totalFiles: 3 }), 'My TeensyROM')).toEqual({
      severity: 'info',
      message: 'Sending 3 files to My TeensyROM',
    });
  });

  it('says "1 file" for a single file', () => {
    expect(buildStartAnnouncement(createSnapshot({ totalFiles: 1 }), 'TR').message).toBe(
      'Sending 1 file to TR'
    );
  });

  it('names the last segment of the watched folder', () => {
    expect(
      buildStartAnnouncement(createSnapshot({ totalFiles: 2, origin: watchFolder }), 'TR')
    ).toEqual({ severity: 'info', message: 'Sending 2 files from incoming to TR' });
  });

  it('drops the count while it is unknown', () => {
    expect(buildStartAnnouncement(createSnapshot(), 'TR').message).toBe('Sending files to TR');
    expect(buildStartAnnouncement(createSnapshot({ origin: watchFolder }), 'TR').message).toBe(
      'Sending files from incoming to TR'
    );
  });

  it('falls back to this tab own scan total when the job does not know its count', () => {
    expect(buildStartAnnouncement(createSnapshot(), 'TR', 5).message).toBe('Sending 5 files to TR');
  });

  it('prefers the job count over the scan total, and ignores an empty scan total', () => {
    expect(buildStartAnnouncement(createSnapshot({ totalFiles: 7 }), 'TR', 5).message).toBe(
      'Sending 7 files to TR'
    );
    expect(buildStartAnnouncement(createSnapshot(), 'TR', 0).message).toBe('Sending files to TR');
  });
});

describe('buildEndAnnouncement', () => {
  const completed = (overrides: Partial<TransferJobSnapshot> = {}) =>
    createSnapshot({ state: TransferJobState.Completed, filesSent: 4, ...overrides });

  describe('Completed', () => {
    it('is a success when everything arrived and nothing was launched', () => {
      expect(buildEndAnnouncement(completed(), 'TR')).toEqual({
        severity: 'success',
        message: 'Sent 4 files to TR',
      });
      expect(buildEndAnnouncement(completed({ filesSent: 1 }), 'TR').message).toBe('Sent 1 file to TR');
    });

    it('reports files that did not arrive, as an error', () => {
      expect(buildEndAnnouncement(completed({ filesSent: 3, filesFailed: 1 }), 'TR')).toEqual({
        severity: 'error',
        message: "Sent 3 of 4 files to TR · 1 didn't arrive",
      });
    });

    it('appends the launched file, still a success', () => {
      expect(
        buildEndAnnouncement(
          completed({
            launchState: TransferLaunchState.Launched,
            launchedPath: '/games/Impossible Mission.crt',
          }),
          'TR'
        )
      ).toEqual({
        severity: 'success',
        message: 'Sent 4 files to TR · launched Impossible Mission.crt',
      });
    });

    it('appends a failed launch with its reason, as an error', () => {
      expect(
        buildEndAnnouncement(
          completed({
            launchState: TransferLaunchState.Failed,
            launchedPath: '/games/a.prg',
            launchError: 'device did not answer',
          }),
          'TR'
        )
      ).toEqual({
        severity: 'error',
        message: "Sent 4 files to TR · couldn't launch a.prg: device did not answer",
      });
    });

    it('drops the reason of a failed launch when there is none', () => {
      expect(
        buildEndAnnouncement(
          completed({ launchState: TransferLaunchState.Failed, launchedPath: '/games/a.prg' }),
          'TR'
        ).message
      ).toBe("Sent 4 files to TR · couldn't launch a.prg");
    });

    it('appends an incompatible file, as an error', () => {
      expect(
        buildEndAnnouncement(
          completed({
            launchState: TransferLaunchState.Incompatible,
            launchedPath: '/games/a.d64',
          }),
          'TR'
        )
      ).toEqual({
        severity: 'error',
        message: "Sent 4 files to TR · a.d64 can't run on the TeensyROM",
      });
    });

    it('combines the failed-file base with the launch suffix', () => {
      expect(
        buildEndAnnouncement(
          completed({
            filesSent: 2,
            filesFailed: 1,
            launchState: TransferLaunchState.Launched,
            launchedPath: '/games/a.prg',
          }),
          'TR'
        )
      ).toEqual({
        severity: 'error',
        message: "Sent 2 of 3 files to TR · 1 didn't arrive · launched a.prg",
      });
    });
  });

  it('words a cancelled transfer as an error', () => {
    expect(
      buildEndAnnouncement(createSnapshot({ state: TransferJobState.Cancelled, filesSent: 2 }), 'TR')
    ).toEqual({ severity: 'error', message: 'Transfer to TR cancelled · 2 files sent' });
  });

  it('words an aborted transfer with its reason, or without one', () => {
    const aborted = createSnapshot({
      state: TransferJobState.Aborted,
      filesSent: 1,
      error: 'device disconnected',
    });
    expect(buildEndAnnouncement(aborted, 'TR')).toEqual({
      severity: 'error',
      message: 'Transfer to TR stopped: device disconnected · 1 file sent',
    });
    expect(buildEndAnnouncement({ ...aborted, error: null }, 'TR').message).toBe(
      'Transfer to TR stopped · 1 file sent'
    );
  });

  it('words an abandoned transfer as an error', () => {
    expect(
      buildEndAnnouncement(createSnapshot({ state: TransferJobState.Abandoned, filesSent: 0 }), 'TR')
    ).toEqual({
      severity: 'error',
      message: 'Transfer to TR stopped: the sender went away · 0 files sent',
    });
  });

  it('refuses to announce the end of a job that has not ended', () => {
    expect(() => buildEndAnnouncement(createSnapshot(), 'TR')).toThrow();
  });
});
