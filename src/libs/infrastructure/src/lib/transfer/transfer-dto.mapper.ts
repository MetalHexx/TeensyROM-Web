import {
  TransferJobDto,
  TransferJobDto2,
  TransferFileCompleted,
  TransferJobState as ApiTransferJobState,
  TeensyStorageType,
} from '@teensyrom-nx/data-access/api-client';
import {
  StorageType,
  TransferJobSnapshot,
  TransferJobState,
  TransferFileCompletion,
} from '@teensyrom-nx/domain';

/**
 * Normalizes the generated transfer job DTOs into the domain snapshot.
 *
 * The generator emits two structurally identical job types - `TransferJobDto` and
 * `TransferJobDto2` - because the active-job response re-references the DTO. They do not
 * unify in TypeScript, so both are mapped through this single class so the duplication
 * never reaches `libs/application`.
 */
export class TransferDtoMapper {
  static toSnapshot(dto: TransferJobDto | TransferJobDto2): TransferJobSnapshot {
    return {
      jobId: dto.jobId,
      deviceId: dto.deviceId,
      storageType: this.toStorageType(dto.storageType),
      destinationDirectory: dto.destinationDirectory,
      state: this.toJobState(dto.state),
      filesReceived: dto.filesReceived,
      filesSent: dto.filesSent,
      filesFailed: dto.filesFailed,
      totalFiles: dto.totalFiles ?? null,
      currentFile: dto.currentFile ?? null,
      // Re-wrapped in Date: SignalR-pushed dtos skip the generated fromJSON deserializer
      // (that's REST-only), so startedUtc arrives as a raw ISO string over the hub.
      startedUtc: new Date(dto.startedUtc),
      error: dto.error ?? null,
      failures: dto.failures.map((failure) => this.toFileCompletion(failure)),
    };
  }

  /** Normalizes a single file-completion event, also used directly for the hub's `FileCompleted` push. */
  static toFileCompletion(dto: TransferFileCompleted): TransferFileCompletion {
    return {
      jobId: dto.jobId,
      relativePath: dto.relativePath,
      targetPath: dto.targetPath,
      success: dto.success,
      error: dto.error,
      sizeBytes: dto.sizeBytes,
    };
  }

  private static toStorageType(apiType: TeensyStorageType): StorageType {
    switch (apiType) {
      case TeensyStorageType.Sd:
        return StorageType.Sd;
      case TeensyStorageType.Usb:
        return StorageType.Usb;
      default:
        throw new Error(`Unknown API storage type: ${apiType}`);
    }
  }

  private static toJobState(apiState: ApiTransferJobState): TransferJobState {
    switch (apiState) {
      case ApiTransferJobState.Created:
        return TransferJobState.Created;
      case ApiTransferJobState.Receiving:
        return TransferJobState.Receiving;
      case ApiTransferJobState.Sealed:
        return TransferJobState.Sealed;
      case ApiTransferJobState.Completed:
        return TransferJobState.Completed;
      case ApiTransferJobState.Cancelling:
        return TransferJobState.Cancelling;
      case ApiTransferJobState.Cancelled:
        return TransferJobState.Cancelled;
      case ApiTransferJobState.Abandoned:
        return TransferJobState.Abandoned;
      case ApiTransferJobState.Aborted:
        return TransferJobState.Aborted;
      default:
        throw new Error(`Unknown API transfer job state: ${apiState}`);
    }
  }
}
