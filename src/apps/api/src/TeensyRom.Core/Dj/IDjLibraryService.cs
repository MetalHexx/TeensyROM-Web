namespace TeensyRom.Core.Dj
{
    /// <summary>
    /// The outcome of saving a set.
    /// </summary>
    public enum DjSaveResult { Saved, LimitReached, Failed }

    /// <summary>
    /// Stores DJ sets, tune memory and the current-set state as files under the engine's home.
    /// Methods throw <see cref="ArgumentException"/> for an id that is not a valid set id or SID hash.
    /// </summary>
    public interface IDjLibraryService
    {
        /// <summary>
        /// Summaries of every readable set. Corrupt set files are skipped.
        /// </summary>
        IReadOnlyList<DjSetSummary> ListSets();

        /// <summary>
        /// The set, or null when it is missing or its file is corrupt.
        /// </summary>
        DjSet? GetSet(string setId);

        /// <summary>
        /// Writes the set. A new id beyond the set limit is not written.
        /// </summary>
        DjSaveResult SaveSet(DjSet set);

        /// <summary>
        /// True when the set is gone (or never existed); false when its file could not be removed.
        /// </summary>
        bool DeleteSet(string setId);

        /// <summary>
        /// The memory for the tune, or null when there is none or its file is corrupt.
        /// </summary>
        DjTuneMemory? GetTuneMemory(string sidHash);

        bool SaveTuneMemory(DjTuneMemory memory);

        /// <summary>
        /// The library state, with no current set when none was saved or its file is corrupt.
        /// </summary>
        DjLibraryState GetLibraryState();

        bool SaveLibraryState(DjLibraryState state);
    }
}
