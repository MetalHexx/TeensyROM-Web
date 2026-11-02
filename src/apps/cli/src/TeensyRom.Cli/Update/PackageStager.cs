using System.Formats.Tar;
using System.IO.Compression;

namespace TeensyRom.Cli.Update;

/// <summary>Brings a release's package to disk, unpacked and checked, ready to swap in.</summary>
internal interface IPackageStager
{
    /// <summary>
    /// Downloads and verifies <paramref name="asset"/>, unpacks it into the update folder's <c>staging</c> and checks that
    /// the unpacked trom runs and reports the release's version. Returns the staging folder.
    /// </summary>
    /// <exception cref="Errors.CliException">When any of that fails; nothing in the install has been touched.</exception>
    Task<string> StageAsync(string root, ReleaseInfo release, ReleaseAsset asset, string rid, IProgress<DownloadProgress>? progress, CancellationToken ct);
}

internal sealed class PackageStager(IReleaseClient client, IProcessRunner runner, IFileOps files) : IPackageStager
{
    /// <summary>Free space wanted, as a multiple of the package: the download, the unpacked files and the backup of what they replace.</summary>
    internal const int SpaceFactor = 4;

    /// <summary>Long because the first run of a freshly written ~100 MB executable can wait on Defender's scan of it.</summary>
    public static readonly TimeSpan ProbeTimeout = TimeSpan.FromSeconds(60);

    public async Task<string> StageAsync(string root, ReleaseInfo release, ReleaseAsset asset, string rid, IProgress<DownloadProgress>? progress, CancellationToken ct)
    {
        var updateFolder = UpdateFolder.For(root);
        var staging = UpdateFolder.Staging(updateFolder);
        var archive = Path.Combine(UpdateFolder.Download(updateFolder), asset.Name);

        EnsureSpace(root, asset);

        files.CreateDirectory(UpdateFolder.Download(updateFolder));
        files.DeleteDirectory(staging);
        files.CreateDirectory(staging);

        await client.DownloadVerifiedAsync(asset, archive, progress, ct);

        Unpack(archive, staging, asset.Name);

        if (MissingParts(files, staging, rid) is { Count: > 0 } missing)
        {
            throw UpdateFailure.Failed($"{asset.Name} isn't a complete TeensyROM Suite package (missing {string.Join(", ", missing)}); nothing was changed.");
        }

        var trom = Path.Combine(staging, "cli", PlatformRid.TromExecutable(rid));

        files.MakeExecutable(Path.Combine(staging, "api", PlatformRid.ApiExecutable(rid)));
        files.MakeExecutable(trom);

        await CheckRunsAsync(trom, release, asset.Name, ct);

        return staging;
    }

    /// <summary>What a package must hold, relative to its top, that the unpacked folder at <paramref name="folder"/> doesn't.</summary>
    internal static IReadOnlyList<string> MissingParts(IFileOps files, string folder, string rid) =>
        new[]
        {
            "README.txt",
            $"api/{PlatformRid.ApiExecutable(rid)}",
            "api/appsettings.json",
            "api/wwwroot/index.html",
            $"cli/{PlatformRid.TromExecutable(rid)}"
        }
        .Where(part => !files.FileExists(Path.Combine(folder, part)))
        .ToList();

    private void EnsureSpace(string root, ReleaseAsset asset)
    {
        var needed = asset.Size * SpaceFactor;

        if (needed > 0 && files.FreeSpace(root) is { } free && free < needed)
        {
            throw UpdateFailure.Failed($"There isn't enough free disk space beside {root} to update: about {needed / (1024 * 1024)} MB is needed, {free / (1024 * 1024)} MB is free.");
        }
    }

    // A package that was built for another CPU, or was damaged after its checksum, fails here rather than after Trom API
    // has been stopped; running it also has Defender scan it now rather than in the middle of the swap.
    private async Task CheckRunsAsync(string trom, ReleaseInfo release, string packageName, CancellationToken ct)
    {
        var run = await runner.RunAsync(trom, ["--version"], ProbeTimeout, null, ct);

        if (!run.Succeeded)
        {
            throw UpdateFailure.Failed($"The trom in {packageName} won't run here ({run.Describe()}); nothing was changed.");
        }

        if (run.ReportedTromVersion != release.Version)
        {
            throw UpdateFailure.Failed($"The trom in {packageName} reports {run.FirstLine ?? "no version"} instead of trom {release.Version}; nothing was changed.");
        }
    }

    private static void Unpack(string archive, string destination, string name)
    {
        try
        {
            if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) UnpackZip(archive, destination);
            else UnpackTar(archive, destination);
        }
        catch (Exception ex) when (ex is InvalidDataException or IOException)
        {
            throw UpdateFailure.Failed($"Couldn't unpack {name}: {ex.Message.TrimEnd('.')}; nothing was changed.");
        }
    }

    private static void UnpackZip(string archive, string destination)
    {
        using var zip = ZipFile.OpenRead(archive);

        foreach (var entry in zip.Entries)
        {
            if (Target(destination, entry.FullName) is not { } target) continue;

            if (entry.FullName.EndsWith('/') || entry.FullName.EndsWith('\\'))
            {
                Directory.CreateDirectory(target);
                continue;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            entry.ExtractToFile(target, overwrite: true);
        }
    }

    // Links and devices have no place in the package; TarEntry.ExtractToFile keeps the Unix mode of a file.
    private static void UnpackTar(string archive, string destination)
    {
        using var file = File.OpenRead(archive);
        using var gzip = new GZipStream(file, CompressionMode.Decompress);
        using var tar = new TarReader(gzip);

        while (tar.GetNextEntry() is { } entry)
        {
            switch (entry.EntryType)
            {
                case TarEntryType.Directory:
                    if (Target(destination, entry.Name) is { } folder) Directory.CreateDirectory(folder);
                    break;

                case TarEntryType.RegularFile or TarEntryType.V7RegularFile:
                    if (Target(destination, entry.Name) is not { } target) break;

                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    entry.ExtractToFile(target, overwrite: true);
                    break;

                case TarEntryType.GlobalExtendedAttributes or TarEntryType.ExtendedAttributes:
                    break;

                default:
                    throw UpdateFailure.Failed($"The package holds an entry of an unexpected kind ({entry.EntryType}: {entry.Name}); nothing was changed.");
            }
        }
    }

    /// <summary>
    /// Where the archive entry <paramref name="name"/> lands inside <paramref name="destination"/>; null for the top folder
    /// itself. An entry that would land outside it is refused.
    /// </summary>
    internal static string? Target(string destination, string name)
    {
        var relative = name.Replace('\\', '/');

        while (relative.StartsWith("./", StringComparison.Ordinal)) relative = relative[2..];

        if (relative.Length == 0 || relative == ".") return null;

        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(destination));
        var target = Path.GetFullPath(Path.Combine(root, relative));

        if (relative.StartsWith('/') || relative.Split('/').Contains("..") || !target.StartsWith(root + Path.DirectorySeparatorChar, PackageSwapper.PathComparison))
        {
            throw UpdateFailure.Failed($"The package holds an entry that would be written outside its own folder ({name}), so it was refused; nothing was changed.");
        }
        return target;
    }
}
