using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

internal sealed class FileLsSettings : StorageSettings
{
    [CommandArgument(0, "[PATH]")]
    [Description("The directory to list. Defaults to the root of the storage. Use - to read it from stdin.")]
    public string Path { get; set; } = "/";

    [CommandOption("--full")]
    [Description("Write every file's full metadata in JSON, as file launch does.")]
    public bool Full { get; set; }

    public override ValidationResult Validate()
    {
        var path = FileCommandOptions.ValidatePath(Path);

        return path.Successful ? base.Validate() : path;
    }
}

/// <summary>
/// <c>trom file ls [PATH]</c>: the subdirectories and then the files of one directory. Piped, it writes one path per
/// line, directories with a trailing <c>/</c>.
/// </summary>
internal sealed class FileLsCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IStdinPaths stdin) : DeviceCommand<FileLsSettings>(output, engine, chooser, devices, storage, settingsService)
{
    protected override async Task<int> RunAsync(CommandContext context, FileLsSettings settings, CancellationToken ct)
    {
        var path = FileCommandOptions.ReadPath(stdin, settings.Path);
        var listing = await storage.GetDirectory(path);
        var storageName = FileItemJson.StorageName(storage.StorageType);

        var directories = listing.Directories.Select(directory => new DirectoryItemJson(directory.Name, directory.Path, storageName)).ToList();
        var files = listing.Files.Select(file => FileItemJson.From(file, storage.StorageType)).ToList();
        IReadOnlyList<object> jsonFiles = settings.Full
            ? listing.Files.Select(file => (object)FileItemJson.Full(file, storage.StorageType)).ToList()
            : files;

        switch (Output.Mode)
        {
            case OutputMode.Json:
                Output.Json(new FileListingJson(path, storageName, directories, jsonFiles));
                break;
            case OutputMode.Plain:
                Output.Lines(directories.Select(directory => directory.Path.EnsureUnixPathEnding()).Concat(files.Select(file => file.Path)));
                break;
            default:
                if (directories.Count + files.Count > 0) Output.Out.Write(ToTable(directories, files));
                break;
        }

        if (directories.Count + files.Count == 0) Output.Notice($"{path} is empty.");

        return 0;
    }

    private static Table ToTable(IReadOnlyList<DirectoryItemJson> directories, IReadOnlyList<FileItemJson> files)
    {
        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

        table.AddColumn("Name");
        table.AddColumn("Type");
        table.AddColumn(new TableColumn("Size").RightAligned());

        foreach (var directory in directories) table.AddRow(new Text($"{directory.Name}/"), new Text("dir"), new Text(string.Empty));

        foreach (var file in files) table.AddRow(new Text(file.Name), new Text(file.FileType.ToString()), new Text(FormatSize(file.Size)));

        return table;
    }

    private static string FormatSize(long bytes) => bytes switch
    {
        < 1024 => $"{bytes} B",
        < 1024 * 1024 => $"{bytes / 1024.0:0.#} KB",
        _ => $"{bytes / (1024.0 * 1024.0):0.#} MB"
    };
}
