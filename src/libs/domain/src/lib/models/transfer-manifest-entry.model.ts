/** A single file matched during a scan, queued for upload within a transfer job. */
export interface TransferManifestEntry {
  file: File;
  relativePath: string;
  sizeBytes: number;
}
