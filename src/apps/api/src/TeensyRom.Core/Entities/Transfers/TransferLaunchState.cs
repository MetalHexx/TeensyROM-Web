namespace TeensyRom.Core.Entities.Transfers
{
    /// <summary>
    /// Outcome of the launch a completed transfer triggers. <see cref="Pending"/> is set together with the
    /// job's Completed state and always resolves to one of the final values.
    /// </summary>
    public enum TransferLaunchState { None, Pending, Launched, Incompatible, Failed }
}
