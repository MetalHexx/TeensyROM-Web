namespace TeensyRom.Cli.Api;

/// <summary>
/// Where the CLI finds the tr-web engine.
/// </summary>
internal static class EngineAddress
{
    public const int Port = 10213;

    public const string BaseUrl = "http://localhost:10213";

    /// <summary>The address as shown in messages.</summary>
    public const string DisplayAddress = "localhost:10213";
}
