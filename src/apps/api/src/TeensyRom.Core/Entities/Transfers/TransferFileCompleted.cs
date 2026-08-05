namespace TeensyRom.Core.Entities.Transfers
{
    public sealed record TransferFileCompleted(
        string JobId, string RelativePath, string TargetPath,
        bool Success, string? Error, long SizeBytes);
}
