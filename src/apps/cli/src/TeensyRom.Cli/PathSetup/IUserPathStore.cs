namespace TeensyRom.Cli.PathSetup;

/// <summary>The Windows per-user PATH, exactly as stored: unexpanded, so <c>%VARS%</c> survive a round trip.</summary>
internal interface IUserPathStore
{
    /// <summary>The raw value, or null when the user has no PATH of their own.</summary>
    string? Read();

    /// <summary>Stores <paramref name="value"/> as the user PATH and tells running programs it changed.</summary>
    void Write(string value);
}
