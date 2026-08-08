/** A single file queued for upload within a transfer job. */
export interface TransferManifestEntry {
  relativePath: string;
  sizeBytes: number;
}
