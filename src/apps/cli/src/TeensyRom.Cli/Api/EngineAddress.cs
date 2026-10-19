namespace TeensyRom.Cli.Api;

/// <summary>
/// Where the CLI finds the tr-web engine.
/// </summary>
internal static class EngineAddress
{
    public const int Port = 10213;

    /// <summary>
    /// The engine listens on IPv4 only. A refused connection to <c>localhost</c> takes about 4 s on Windows
    /// (.NET tries <c>::1</c>, then <c>127.0.0.1</c>), to <c>127.0.0.1</c> about 2 s.
    /// </summary>
    public const string BaseUrl = "http://127.0.0.1:10213";

    /// <summary>The address as shown in messages.</summary>
    public const string DisplayAddress = "localhost:10213";
}
