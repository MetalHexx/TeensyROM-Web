using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Entities.Transfers
{
    public sealed record StagedFile(
        string JobId, string StagingPath, string RelativePath,
        FilePath TargetPath, TeensyStorageType TargetStorage,
        long SizeBytes,          // true file size — used for progress reporting
        long ReservedBytes);     // effective capacity-gate reservation — the ONLY value ever released
}
