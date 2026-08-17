import { Inject, Injectable } from '@angular/core';
import {
  TransfersApiService,
  ResponseError,
  ProblemDetails,
  TeensyStorageType,
} from '@teensyrom-nx/data-access/api-client';
import {
  ITransferService,
  TransferJobSnapshot,
  TransferDeviceBusyError,
  TransferCreateRejectedError,
  TransferUploadError,
  API_CONFIG,
  IApiConfig,
  StorageType,
  StorageTypeUtil,
} from '@teensyrom-nx/domain';
import { logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { TransferDtoMapper } from './transfer-dto.mapper';

/** Problem body shape the API returns for a 409 create conflict. */
interface TransferBusyProblemDetails extends ProblemDetails {
  activeJobId?: string | null;
}

/**
 * Infrastructure implementation of ITransferService.
 *
 * Create, seal, cancel, and the active-job read go through the generated
 * `TransfersApiService`. The upload is hand-written on `XMLHttpRequest` because the
 * endpoint reads the raw request stream and the generated method sends no body.
 */
@Injectable()
export class TransferService implements ITransferService {
  constructor(
    private readonly transfersApi: TransfersApiService,
    @Inject(API_CONFIG) private readonly apiConfig: IApiConfig
  ) {}

  async createJob(
    deviceId: string,
    storageType: StorageType,
    destinationDirectory: string,
    expectedArchiveCount: number
  ): Promise<TransferJobSnapshot> {
    try {
      const response = await this.transfersApi.createTransferJob({
        deviceId,
        storageType: StorageTypeUtil.toString(storageType) as TeensyStorageType,
        createJobBody: { destinationDirectory, expectedArchiveCount },
      });
      logInfo(LogType.Success, 'TransferService: Job created', { jobId: response.jobId, deviceId });
      return TransferDtoMapper.toSnapshot(response.job);
    } catch (error) {
      throw await this.toCreateError(error, deviceId);
    }
  }

  uploadFile(jobId: string, file: File, relativePath: string, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('The upload was aborted.', 'AbortError'));
        return;
      }

      const url = `${
        this.apiConfig.basePath
      }/api/transfers/${jobId}/files?Path=${encodeURIComponent(relativePath)}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      // Deliberately no xhr.timeout - the endpoint blocks awaiting queue capacity, and a
      // slow response is the server's backpressure working correctly, not a hang.

      const onAbort = () => xhr.abort();

      const settle = () => {
        signal.removeEventListener('abort', onAbort);
      };

      xhr.onload = () => {
        settle();
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        const retryable = xhr.status >= 500;
        logError(`TransferService.uploadFile failed for "${relativePath}"`, { status: xhr.status });
        reject(
          new TransferUploadError(
            xhr.status,
            retryable,
            `Upload failed for "${relativePath}" with status ${xhr.status}.`
          )
        );
      };

      xhr.onerror = () => {
        settle();
        logError(`TransferService.uploadFile transport error for "${relativePath}"`);
        reject(new TransferUploadError(0, true, `Transport error uploading "${relativePath}".`));
      };

      xhr.onabort = () => {
        settle();
        reject(new DOMException('The upload was aborted.', 'AbortError'));
      };

      signal.addEventListener('abort', onAbort);

      xhr.send(file);
    });
  }

  async sealJob(jobId: string): Promise<void> {
    await this.transfersApi.sealTransferJob({ jobId });
    logInfo(LogType.Success, 'TransferService: Job sealed', { jobId });
  }

  async cancelJob(jobId: string): Promise<TransferJobSnapshot> {
    const response = await this.transfersApi.cancelTransferJob({ jobId });
    logInfo(LogType.Info, 'TransferService: Job cancellation requested', { jobId });
    return TransferDtoMapper.toSnapshot(response.job);
  }

  async getActiveJob(deviceId: string): Promise<TransferJobSnapshot | null> {
    const response = await this.transfersApi.getActiveTransferJob({ deviceId });
    const job = response.job ?? null;
    return job ? TransferDtoMapper.toSnapshot(job) : null;
  }

  /**
   * Classifies a create failure: a 409 means the device already holds an active job
   * (the holding job id travels in the problem body's `activeJobId`), a 400 means the
   * destination path was rejected. Anything else is rethrown as-is.
   */
  private async toCreateError(error: unknown, deviceId: string): Promise<Error> {
    if (error instanceof ResponseError) {
      const status = error.response.status;
      if (status === 409) {
        const activeJobId = await this.readActiveJobId(error.response);
        logError('TransferService.createJob: device busy', { deviceId, activeJobId });
        return new TransferDeviceBusyError(
          activeJobId,
          'Device already has an active transfer job.'
        );
      }
      if (status === 400) {
        logError('TransferService.createJob: destination rejected', { deviceId });
        return new TransferCreateRejectedError('Destination directory was rejected.');
      }
    }
    logError('TransferService.createJob failed', error);
    return error instanceof Error ? error : new Error('Failed to create transfer job.');
  }

  private async readActiveJobId(response: Response): Promise<string | null> {
    try {
      const problem = (await response.clone().json()) as TransferBusyProblemDetails;
      return problem.activeJobId ?? null;
    } catch {
      return null;
    }
  }
}
