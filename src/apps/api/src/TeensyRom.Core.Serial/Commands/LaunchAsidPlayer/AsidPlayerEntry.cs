namespace TeensyRom.Core.Serial.Commands.LaunchAsidPlayer
{
    /// <summary>
    /// Where the firmware keeps its built-in ASID player. The firmware matches the entry by exact name
    /// (<c>strcmp</c> in <c>FindTRMenuItem</c>) and acks the launch before it looks the name up, so a wrong name is
    /// only noticed by the missing <c>Remote Launch:</c> report.
    /// </summary>
    public static class AsidPlayerEntry
    {
        /// <summary>The built-in menu, <c>rmtTeensy</c>, beside USB 0 and SD 1 (<c>SerUSBIO.ino</c> <c>LaunchFile</c>). Exists only on the launch exchange.</summary>
        public const uint BuiltInMenuDrive = 2;

        /// <summary><c>MainMenuItems.h</c> <c>TeensyROMMenu</c>, item 1.</summary>
        public const string Directory = "/MIDI + ASID";

        /// <summary>Four spaces before the '+'; matched exactly.</summary>
        public const string EntryName = "TeensyROM ASID Player    +TR ASID";

        public const string Path = Directory + "/" + EntryName;
    }
}
