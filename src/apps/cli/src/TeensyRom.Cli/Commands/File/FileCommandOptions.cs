using Spectre.Console;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

/// <summary>
/// The option values and paths of the <c>file</c> commands. Values match without regard to case, and every command
/// accepts the same set: the menu's helpers each accept a different one.
/// </summary>
internal static class FileCommandOptions
{
    private static readonly (string Name, TeensyFilterType Value)[] Filters =
    [
        ("all", TeensyFilterType.All),
        ("games", TeensyFilterType.Games),
        ("music", TeensyFilterType.Music),
        ("images", TeensyFilterType.Images),
        ("hex", TeensyFilterType.Hex)
    ];

    private static readonly (string Name, StorageScope Value)[] Scopes =
    [
        ("storage", StorageScope.Storage),
        ("dir-deep", StorageScope.DirDeep),
        ("dir-shallow", StorageScope.DirShallow)
    ];

    private static readonly (string Name, TimeSpan? Value)[] Timers =
    [
        ("none", null),
        ("5s", TimeSpan.FromSeconds(5)),
        ("15s", TimeSpan.FromSeconds(15)),
        ("30s", TimeSpan.FromSeconds(30)),
        ("1m", TimeSpan.FromMinutes(1)),
        ("3m", TimeSpan.FromMinutes(3)),
        ("5m", TimeSpan.FromMinutes(5)),
        ("15m", TimeSpan.FromMinutes(15)),
        ("30m", TimeSpan.FromMinutes(30)),
        ("1h", TimeSpan.FromHours(1))
    ];

    /// <summary><see cref="TeensyFilterType.All"/> when <paramref name="value"/> is null.</summary>
    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when the value is not one of the accepted names.</exception>
    public static TeensyFilterType ParseFilter(string? value) => Parse("--filter", value, Filters, TeensyFilterType.All);

    /// <summary><see cref="StorageScope.DirDeep"/> when <paramref name="value"/> is null.</summary>
    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when the value is not one of the accepted names.</exception>
    public static StorageScope ParseScope(string? value) => Parse("--scope", value, Scopes, StorageScope.DirDeep);

    /// <summary>No timer (null) when <paramref name="value"/> is null or <c>none</c>.</summary>
    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when the value is not one of the accepted names.</exception>
    public static TimeSpan? ParseTimer(string? value) => Parse("--timer", value, Timers, null);

    /// <summary>Runs <paramref name="parse"/> and turns the usage error it throws into a failed validation, so Spectre reports it before the engine starts.</summary>
    public static ValidationResult Check(Action parse)
    {
        try
        {
            parse();
            return ValidationResult.Success();
        }
        catch (CliException error)
        {
            return ValidationResult.Error(error.Message);
        }
    }

    /// <summary>A path argument as the settings can judge it: a valid unix path, or the stdin marker that is checked once it has been read.</summary>
    public static ValidationResult ValidatePath(string path) =>
        path == StdinPaths.Marker || path.IsValidUnixPath()
            ? ValidationResult.Success()
            : ValidationResult.Error("The path must be a valid unix path, such as /music.");

    /// <summary>The path to use for an argument or option that may be <c>-</c>: the first path read from stdin, or the argument itself.</summary>
    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when stdin gave no path or the path is not a valid unix path.</exception>
    public static string ReadPath(IStdinPaths stdin, string arg)
    {
        var path = stdin.ExpandOne(arg);

        return path.IsValidUnixPath()
            ? path
            : throw new CliException(CliExitCode.Usage, $"'{path}' is not a valid unix path, such as /music.");
    }

    private static T Parse<T>(string option, string? value, (string Name, T Value)[] accepted, T whenAbsent)
    {
        if (value is null) return whenAbsent;

        foreach (var (name, parsed) in accepted)
        {
            if (name.Equals(value, StringComparison.OrdinalIgnoreCase)) return parsed;
        }
        throw new CliException(CliExitCode.Usage, $"{option} must be one of: {string.Join(", ", accepted.Select(entry => entry.Name))}.");
    }
}
