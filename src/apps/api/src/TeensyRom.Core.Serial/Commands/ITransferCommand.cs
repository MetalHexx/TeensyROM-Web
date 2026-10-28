namespace TeensyRom.Core.Serial.Commands
{
    /// <summary>A command a transfer job sends while it holds its device's lease. Its job id lets the transfer lockout pass it.</summary>
    public interface ITransferCommand
    {
        string? TransferJobId { get; }
    }
}
