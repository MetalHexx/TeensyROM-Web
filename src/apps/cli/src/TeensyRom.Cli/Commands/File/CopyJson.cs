using Spectre.Console;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.File;

/// <summary>
/// What happened to one file of a <c>file upload|download</c> run.
/// </summary>
/// <param name="LocalPath">
/// A saved file or an I/O failure carries the full local path. A row for a device name that can't be saved, and the row
/// for a safe folder whose listing failed, carry the would-be path under the download target (the target itself for the
/// root). Only a path that was never classified (its parent listing failed, or it was not found) carries an empty string.
/// An upload's path is the local file, or the name as given when it was not found or not a supported type.
/// </param>
internal sealed record CopyResultJson(string LocalPath, string DevicePath, bool Ok, string Message);

/// <summary>How many files a copy run moved and how many failed.</summary>
internal sealed record CopyTotalsJson(int Copied, int Failed);

/// <summary>A copy run's JSON document: <c>{ "files": [ { "localPath", "devicePath", "ok", "message" } ], "totals": { "copied", "failed" } }</c>.</summary>
internal sealed record CopyReportJson(IReadOnlyList<CopyResultJson> Files, CopyTotalsJson Totals);

/// <summary>Builds and writes the results of the copy commands.</summary>
internal static class CopyResults
{
    /// <summary>What a path that does not exist is reported as, by upload and download alike.</summary>
    internal const string NotFoundMessage = "not found";

    public static CopyResultJson Copied(string localPath, string devicePath) => new(localPath, devicePath, true, "Copied");

    public static CopyResultJson Failed(string localPath, string devicePath, string message) => new(localPath, devicePath, false, message);

    /// <summary>
    /// Writes the report as the output mode asks: JSON as the document; piped, the device paths that succeeded, one per line,
    /// then each failure as a notice; in a terminal a table. A run with files copied and none failed then ends with a
    /// "Copied N files." notice on stderr, outside JSON mode.
    /// </summary>
    public static void Show(ICliOutput output, CopyReportJson report)
    {
        switch (output.Mode)
        {
            case OutputMode.Json:
                output.Json(report);
                break;
            case OutputMode.Plain:
                output.Lines(report.Files.Where(file => file.Ok).Select(file => file.DevicePath));
                foreach (var file in report.Files.Where(file => !file.Ok)) output.Notice($"{file.LocalPath}: {file.Message}");
                break;
            default:
                var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

                table.AddColumn("Local path");
                table.AddColumn("Device path");
                table.AddColumn("Result");

                foreach (var file in report.Files)
                {
                    table.AddRow(new Text(file.LocalPath), new Text(file.DevicePath), new Text(file.Ok ? file.Message : $"Failed: {file.Message}"));
                }
                output.Out.Write(table);
                break;
        }

        if (output.Mode != OutputMode.Json && report.Totals.Failed == 0 && report.Totals.Copied > 0)
        {
            output.Notice($"Copied {report.Totals.Copied} {(report.Totals.Copied == 1 ? "file" : "files")}.");
        }
    }
}
