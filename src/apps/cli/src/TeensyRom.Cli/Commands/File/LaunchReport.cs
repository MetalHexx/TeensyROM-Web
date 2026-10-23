using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

/// <summary>
/// Prints the file a launch picked or was given, and turns every outcome but a launch into the exit code it deserves.
/// </summary>
internal sealed class LaunchReport(ICliOutput output)
{
    /// <summary>
    /// Prints the file a launch picked or was given and turns every outcome but a launch into the exit code it deserves.
    /// An incompatible file is still printed: the caller can read what was picked.
    /// </summary>
    /// <param name="notFoundMessage">What to say when tr-web didn't say why it found nothing.</param>
    /// <exception cref="CliException">The file didn't launch.</exception>
    public int Report(LaunchOutcome outcome, TeensyStorageType storageType, string notFoundMessage)
    {
        if (outcome.Item is { } item) Show(outcome, item, storageType);

        return Failure(outcome, notFoundMessage) is { } failure ? throw failure : 0;
    }

    /// <summary>The failure a launch that didn't launch ends the command with; null for <see cref="LaunchStatus.Launched"/>.</summary>
    /// <param name="notFoundMessage">What to say when tr-web didn't say why it found nothing.</param>
    public static CliException? Failure(LaunchOutcome outcome, string notFoundMessage) => outcome.Status switch
    {
        LaunchStatus.Launched => null,
        LaunchStatus.Incompatible => new CliException(CliExitCode.Failed, Said(outcome, $"{outcome.Item?.Name ?? "The file"} can't run on the TeensyROM.")),
        LaunchStatus.NotFound => new CliException(CliExitCode.NotFound, Said(outcome, notFoundMessage)),
        _ => new CliException(CliExitCode.Failed, Said(outcome, "tr-web couldn't launch the file."))
    };

    private void Show(LaunchOutcome outcome, IFileItem item, TeensyStorageType storageType)
    {
        var file = FileItemJson.From(item, storageType);

        switch (output.Mode)
        {
            case OutputMode.Json:
                output.Json(new FileLaunchJson(outcome.Status, FileItemJson.Full(item, storageType), outcome.Message));
                break;
            case OutputMode.Plain:
                output.Lines([file.Path]);
                break;
            default:
                output.Fields(
                [
                    ("Status", outcome.Status.ToString().ToLowerInvariant()),
                    ("Name", file.Name),
                    ("Path", file.Path),
                    ("Storage", file.Storage)
                ]);
                break;
        }
    }

    private static string Said(LaunchOutcome outcome, string fallback) =>
        string.IsNullOrWhiteSpace(outcome.Message) ? fallback : outcome.Message;
}
