namespace TeensyRom.Core.Storage.Index.Fixtures
{
    /// <summary>
    /// The outcome of a completed fixture seed: how many rows landed in each category, and how long the run
    /// took. Two seeds of the same fixture into two fresh databases must agree on every count but
    /// <see cref="Elapsed"/>.
    /// </summary>
    public sealed record SeedResult(int Directories, int Files, int FavoritesMarked, int MetadataRows, TimeSpan Elapsed);

    /// <summary>
    /// A progress report from a running seed. <paramref name="Phase"/> is one of
    /// <c>directories|files|favourites|metadata</c>; <paramref name="FilesWritten"/> and
    /// <paramref name="TotalFiles"/> track the file load regardless of which phase is currently running.
    /// </summary>
    public sealed record SeedProgress(int FilesWritten, int TotalFiles, string Phase);

    /// <summary>
    /// Tuning knobs for a seed run. <see cref="MaxFiles"/> truncates the fixture to a slice, so tests and
    /// development runs can seed part of a full-scale fixture without a separate small one.
    /// </summary>
    public sealed record SeedOptions(bool RunProjection = true, int BatchSize = 1000, int? MaxFiles = null);
}
