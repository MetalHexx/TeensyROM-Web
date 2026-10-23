using System.Globalization;

namespace TeensyRom.Cli.Commands.File;

/// <summary>One local file to send, and where it goes.</summary>
/// <param name="LocalPath">The file's full path on this computer.</param>
/// <param name="RelativePath">Where it lands under the destination folder: '/'-separated, never rooted, never holding <c>..</c>.</param>
internal sealed record UploadFile(string LocalPath, string RelativePath, long Size, bool IsArchive);

/// <summary>What the named sources come to: the files to send, the named paths that don't exist, and the folders that were walked.</summary>
internal sealed record UploadPlan(IReadOnlyList<UploadFile> Files, IReadOnlyList<string> NotFound, IReadOnlyList<string> Folders)
{
    public long TotalSize => Files.Sum(file => file.Size);

    public int ArchiveCount => Files.Count(file => file.IsArchive);
}

/// <summary>Turns the local paths of <c>trom file upload</c> into the files to send.</summary>
internal static class UploadSources
{
    private static readonly string[] ArchiveExtensions = [".zip", ".7z", ".rar"];

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

    /// <summary>
    /// Walks what <paramref name="named"/> names. A file arrives as its name; a folder arrives as a folder of its own name
    /// with its layout kept, except <c>.</c> (and a folder with no name, a drive root), whose contents arrive directly.
    /// No names at all means the contents of <paramref name="currentFolder"/>.
    /// </summary>
    /// <param name="currentFolder">What relative names are resolved against.</param>
    public static UploadPlan Resolve(IReadOnlyList<string> named, string currentFolder)
    {
        var files = new List<UploadFile>();
        var notFound = new List<string>();
        var folders = new List<string>();

        foreach (var path in named.Count == 0 ? new[] { "." } : named)
        {
            var full = Path.GetFullPath(path, currentFolder);

            if (System.IO.File.Exists(full))
            {
                files.Add(Describe(full, Path.GetFileName(full)));
            }
            else if (Directory.Exists(full))
            {
                folders.Add(Path.TrimEndingDirectorySeparator(full));
                files.AddRange(Walk(full, ContentsOnly(path, full) ? string.Empty : Path.GetFileName(Path.TrimEndingDirectorySeparator(full))));
            }
            else
            {
                notFound.Add(path);
            }
        }
        return new UploadPlan(files, notFound, folders);
    }

    /// <summary>The size as the confirmation shows it: KB below a megabyte, otherwise MB.</summary>
    public static string FormatSize(long bytes) => bytes < 1024 * 1024
        ? string.Create(CultureInfo.InvariantCulture, $"{bytes / 1024.0:0.#} KB")
        : string.Create(CultureInfo.InvariantCulture, $"{bytes / (1024.0 * 1024.0):0.#} MB");

    private static bool ContentsOnly(string named, string full) =>
        Path.TrimEndingDirectorySeparator(named) == "." || Path.GetFileName(Path.TrimEndingDirectorySeparator(full)).Length == 0;

    private static IEnumerable<UploadFile> Walk(string root, string prefix) =>
        Directory.EnumerateFiles(root, "*", WalkOptions)
            .Select(file => (File: file, Relative: Path.GetRelativePath(root, file).Replace(Path.DirectorySeparatorChar, '/')))
            .OrderBy(entry => entry.Relative, StringComparer.Ordinal)
            .Select(entry => Describe(entry.File, prefix.Length == 0 ? entry.Relative : $"{prefix}/{entry.Relative}"));

    private static UploadFile Describe(string localPath, string relativePath)
    {
        var info = new FileInfo(localPath);

        return new UploadFile(localPath, relativePath, info.Exists ? info.Length : 0, IsArchive(relativePath));
    }
}
