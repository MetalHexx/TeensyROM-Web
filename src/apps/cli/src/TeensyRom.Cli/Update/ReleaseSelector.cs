namespace TeensyRom.Cli.Update;

/// <summary>Picks the release an install may update to.</summary>
internal static class ReleaseSelector
{
    /// <summary>A stable release is always a candidate; a pre-release only for an install that is itself a pre-release.</summary>
    public static bool Admits(ReleaseInfo candidate, SemVersion installed) => !candidate.IsPreRelease || installed.IsPreRelease;

    /// <summary>The highest version <paramref name="installed"/> admits that has a package for <paramref name="rid"/>; null when none does.</summary>
    public static ReleaseInfo? Newest(IEnumerable<ReleaseInfo> releases, SemVersion installed, string rid) =>
        Newest(releases, rid, installed.IsPreRelease);

    public static ReleaseInfo? Newest(IEnumerable<ReleaseInfo> releases, string rid, bool includePreReleases) =>
        releases
            .Where(release => (includePreReleases || !release.IsPreRelease) && PackageFor(release, rid) is not null)
            .OrderByDescending(release => release.Version)
            .FirstOrDefault();

    /// <summary>The release's package for <paramref name="rid"/>, found by the name the release workflow gives it.</summary>
    public static ReleaseAsset? PackageFor(ReleaseInfo release, string rid)
    {
        var name = PlatformRid.AssetName(release.Version, rid);

        return release.Assets.FirstOrDefault(asset => string.Equals(asset.Name, name, StringComparison.Ordinal));
    }
}
