using System.Globalization;

namespace TeensyRom.Cli.Commands.File;

/// <summary>One local file to send, and where it goes.</summary>
/// <param name="LocalPath">The file's full path on this computer.</param>
/// <param name="RelativePath">Where it lands under the destination folder: '/'-separated, never rooted, never holding <c>..</c>.</param>
internal sealed record UploadFile(string LocalPath, string RelativePath, long Size, bool IsArchive);

/// <summary>
/// What the named sources come to: the files to send, the named paths that don't exist, the named files of a type the
/// TeensyROM doesn't take, the folders that were walked, and how many walked files were left out for their type.
/// </summary>
internal sealed record UploadPlan(
    IReadOnlyList<UploadFile> Files,
    IReadOnlyList<string> NotFound,
    IReadOnlyList<string> Folders,
    IReadOnlyList<string> Unsupported,
    int SkippedByType = 0)
{
    public long TotalSize => Files.Sum(file => file.Size);
}

/// <summary>Turns the local paths of <c>trom file upload</c> into the files to send.</summary>
internal static class UploadSources
{
    private static readonly string[] ArchiveExtensions = [".zip", ".7z", ".rar"];

    // The file types the web app's drop zone takes; archives are in because the engine expands them.
    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".sid", ".crt", ".prg", ".p00", ".hex", ".kla", ".koa", ".art", ".aas", ".hpi", ".seq", ".txt", ".d64", ".zip", ".7z", ".rar"
    };

    // Links are never followed, so a walk can't leave the named folder or loop; hidden and system files (.DS_Store, Thumbs.db) stay home.
    private static readonly EnumerationOptions WalkOptions = new()
    {
        RecurseSubdirectories = true,
        IgnoreInaccessible = true,
        AttributesToSkip = FileAttributes.Hidden | FileAttributes.System | FileAttributes.ReparsePoint
    };

    /// <summary>Whether tr-web expands the file instead of storing it.</summary>
    public static bool IsArchive(string fileName) =>
        ArchiveExtensions.Contains(Path.GetExtension(fileName), StringComparer.OrdinalIgnoreCase);

    /// <summary>Whether the TeensyROM takes files of this name's type.</summary>
    public static bool IsSupported(string fileName) => SupportedExtensions.Contains(Path.GetExtension(fileName));

    /// <summary>
    /// Walks what <paramref name="named"/> names. A file arrives as its name; a folder arrives as a folder of its own name
    /// with its layout kept, except <c>.</c> (and a folder with no name, a drive root), whose contents arrive directly.
    /// No names at all means the contents of <paramref name="currentFolder"/>. Only supported file types are kept: a named
    /// file of another type is listed as unsupported, and walked files of another type are only counted. Hidden, system and
    /// linked files are skipped by the walk without being counted.
    /// </summary>
    /// <param name="currentFolder">What relative names are resolved against.</param>
    public static UploadPlan Resolve(IReadOnlyList<string> named, string currentFolder)
    {
        var files = new List<UploadFile>();
        var notFound = new List<string>();
        var folders = new List<string>();
        var unsupported = new List<string>();
        var skipped = 0;

        foreach (var path in named.Count == 0 ? new[] { "." } : named)
        {
            var full = Path.GetFullPath(path, currentFolder);

            if (System.IO.File.Exists(full))
            {
                if (IsSupported(full)) files.Add(Describe(full, Path.GetFileName(full)));
                else unsupported.Add(path);
            }
            else if (Directory.Exists(full))
            {
                folders.Add(Path.TrimEndingDirectorySeparator(full));

                var walked = Walk(full, ContentsOnly(path, full) ? string.Empty : Path.GetFileName(Path.TrimEndingDirectorySeparator(full)));

                files.AddRange(walked.Supported);
                skipped += walked.Skipped;
            }
            else
            {
                notFound.Add(path);
            }
        }
        return new UploadPlan(files, notFound, folders, unsupported, skipped);
    }

    /// <summary>The size as the confirmation shows it: KB below a megabyte, otherwise MB.</summary>
    public static string FormatSize(long bytes) => bytes < 1024 * 1024
        ? string.Create(CultureInfo.InvariantCulture, $"{bytes / 1024.0:0.#} KB")
        : string.Create(CultureInfo.InvariantCulture, $"{bytes / (1024.0 * 1024.0):0.#} MB");

    private static bool ContentsOnly(string named, string full) =>
        Path.TrimEndingDirectorySeparator(named) == "." || Path.GetFileName(Path.TrimEndingDirectorySeparator(full)).Length == 0;

    private static (List<UploadFile> Supported, int Skipped) Walk(string root, string prefix)
    {
        var entries = Directory.EnumerateFiles(root, "*", WalkOptions)
            .Select(file => (File: file, Relative: Path.GetRelativePath(root, file).Replace(Path.DirectorySeparatorChar, '/')))
            .OrderBy(entry => entry.Relative, StringComparer.Ordinal)
            .ToList();
        var supported = entries.Where(entry => IsSupported(entry.File))
            .Select(entry => Describe(entry.File, prefix.Length == 0 ? entry.Relative : $"{prefix}/{entry.Relative}"))
            .ToList();

        return (supported, entries.Count - supported.Count);
    }

    private static UploadFile Describe(string localPath, string relativePath)
    {
        var info = new FileInfo(localPath);

        return new UploadFile(localPath, relativePath, info.Exists ? info.Length : 0, IsArchive(relativePath));
    }
}
