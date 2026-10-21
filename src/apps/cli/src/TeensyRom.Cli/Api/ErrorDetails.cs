namespace TeensyRom.Cli.Api;

/// <summary>
/// What a failed request knew, for scripts that read the <c>details</c> of the JSON error object.
/// </summary>
/// <param name="Path">The path the request was about.</param>
/// <param name="Device">The name of the device it was sent to.</param>
/// <param name="Attempts">How many times the request was made.</param>
/// <param name="PossibleCauses">Why it may have failed.</param>
internal sealed record ErrorDetails(string Path, string Device, int Attempts, IReadOnlyList<string> PossibleCauses);
