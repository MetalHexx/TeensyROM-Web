namespace TeensyRom.Core.Commands
{
    public class TeensyCommandResult
    {
        public bool IsSuccess { get; set; } = true;
        public bool IsBusy { get; set; } = false;
        public string Error = string.Empty;

        /// <summary>Set only when the transfer lockout refused the command: the job that holds the device's lease.</summary>
        public string? ActiveTransferJobId { get; set; }
    }
}
