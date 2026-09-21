namespace TeensyRom.Core.Serial.Commands.LaunchFile
{
    public enum LaunchFileResultType
    {
        Success,
        SidError,
        Error,
        ProgramError,
        NoResponse,
        Disconnected,
        /// <summary>TeensyROM declined the launch outright (a <see cref="TeensyToken.RetryLaunch"/> reply).</summary>
        Declined,
        /// <summary>
        /// Internal-use only: the "Loading IO handler:" text, distinct from <see cref="Success"/> so the
        /// watch phase can tell it apart from a final <see cref="TeensyToken.GoodSIDToken"/> reply - a
        /// large cartridge may print it and then reboot into minimal. Never reported outside the handler;
        /// <c>GetFinalResult</c> maps it to <see cref="Success"/>.
        /// </summary>
        Loading
    }
}
