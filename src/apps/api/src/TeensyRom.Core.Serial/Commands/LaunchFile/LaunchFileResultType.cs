namespace TeensyRom.Core.Serial.Commands.LaunchFile
{
    public enum LaunchFileResultType
    {
        // Deliberately not the zero value: a default-constructed LaunchFileResult must never read as a
        // silent success (e.g. the gate's generic failure path constructs one via `new()` and only sets
        // IsSuccess, leaving LaunchResult at its default). Kept out of SidError/ProgramError too, so a
        // defaulted result doesn't flip LaunchFileResult.IsCompatible to false and change what
        // LaunchFileEndpoint sends for a case that never set LaunchResult explicitly.
        Error,
        SidError,
        ProgramError,
        NoResponse,
        Disconnected,
        /// <summary>TeensyROM declined the launch outright (a <see cref="TeensyToken.RetryLaunch"/> reply).</summary>
        Declined,
        Success,
        /// <summary>
        /// Internal-use only: the "Loading IO handler:" text, distinct from <see cref="Success"/> so the
        /// watch phase can tell it apart from a final <see cref="TeensyToken.GoodSIDToken"/> reply - a
        /// large cartridge may print it and then reboot into minimal. Never reported outside the handler;
        /// <c>GetFinalResult</c> maps it to <see cref="Success"/>.
        /// </summary>
        Loading
    }
}
