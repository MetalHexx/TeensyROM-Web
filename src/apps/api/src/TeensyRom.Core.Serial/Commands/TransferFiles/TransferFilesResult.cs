namespace TeensyRom.Core.Commands
{
    public sealed class TransferFilesResult : TeensyCommandResult
    {
        public List<TransferFileOutcome> Outcomes { get; set; } = [];
    }
}
