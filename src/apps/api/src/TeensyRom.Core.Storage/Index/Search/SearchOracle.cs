using System.Text.Json;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Storage.Index.Search
{
    /// <summary>
    /// One term the search oracle pins: what a correct search must find, what it must not, and the count it
    /// must stay within. <see cref="MaxResults"/> is what catches a predicate that matches far more than it
    /// should — the failure mode the oracle exists to guard against.
    /// </summary>
    public sealed record SearchOracleCase(
        string Term,
        string Intent,
        IReadOnlyList<string> ExpectedPaths,
        IReadOnlyList<string> MustNotMatch,
        int MinResults,
        int MaxResults);

    /// <summary>
    /// The collection the oracle's terms and counts were drawn from, and the metadata export that enriched
    /// it. Exact expected paths and exact result counts only mean anything against that pair, so an oracle
    /// that does not name it cannot be checked — and a machine holding a different one must be told to skip
    /// rather than fail.
    /// </summary>
    public sealed record SearchOracleCollection(string DeviceId, TeensyStorageType StorageType, int FileCount, string MetadataSource);

    /// <summary>The committed oracle: the collection it was curated against, and the cases drawn from it.</summary>
    public sealed record SearchOracleDocument(SearchOracleCollection Collection, IReadOnlyList<SearchOracleCase> Cases);

    /// <summary>
    /// Loads the committed search oracle: a small, human-edited set of real search terms and the bounds a
    /// correct search must satisfy against them.
    /// </summary>
    public static class SearchOracle
    {
        private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };

        /// <summary>
        /// Reads and validates the oracle at <paramref name="path"/>. A malformed case — an empty (or
        /// missing) term, a negative bound, or a minimum above its maximum — throws naming that case rather
        /// than being silently skipped, which would otherwise pass for the wrong reason. An oracle that does
        /// not name the collection it was curated against throws for the same reason.
        /// </summary>
        public static SearchOracleDocument Load(string path)
        {
            ArgumentNullException.ThrowIfNull(path);

            var document = Deserialize(path);

            if (document.Cases is null || document.Cases.Count == 0)
            {
                throw new InvalidDataException($"The search oracle at '{path}' declares no cases.");
            }

            var cases = new List<SearchOracleCase>(document.Cases.Count);

            for (var index = 0; index < document.Cases.Count; index++)
            {
                cases.Add(Validate(document.Cases[index], index, path));
            }

            return new SearchOracleDocument(ValidateCollection(document.Collection, path), cases);
        }

        private static SearchOracleCollection ValidateCollection(RawCollection? raw, string path)
        {
            if (raw is null || string.IsNullOrWhiteSpace(raw.DeviceId))
            {
                throw new InvalidDataException(
                    $"The search oracle at '{path}' does not name the collection it was curated against.");
            }

            if (!Enum.TryParse<TeensyStorageType>(raw.StorageType, ignoreCase: true, out var storageType))
            {
                throw new InvalidDataException(
                    $"The search oracle at '{path}' names an unknown storage type '{raw.StorageType}'.");
            }

            if (raw.FileCount <= 0)
            {
                throw new InvalidDataException(
                    $"The search oracle at '{path}' records a non-positive file count ({raw.FileCount}).");
            }

            if (string.IsNullOrWhiteSpace(raw.MetadataSource))
            {
                throw new InvalidDataException(
                    $"The search oracle at '{path}' does not name the metadata export its counts were drawn with.");
            }

            return new SearchOracleCollection(raw.DeviceId, storageType, raw.FileCount, raw.MetadataSource);
        }

        private static RawDocument Deserialize(string path)
        {
            string json;

            try
            {
                json = File.ReadAllText(path);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                throw new InvalidDataException($"Could not read the search oracle at '{path}': {exception.Message}", exception);
            }

            try
            {
                return JsonSerializer.Deserialize<RawDocument>(json, Options)
                    ?? throw new InvalidDataException($"The search oracle at '{path}' is empty.");
            }
            catch (JsonException exception)
            {
                throw new InvalidDataException($"The search oracle at '{path}' is not valid JSON: {exception.Message}", exception);
            }
        }

        private static SearchOracleCase Validate(RawCase raw, int index, string path)
        {
            var label = !string.IsNullOrWhiteSpace(raw.Term)
                ? raw.Term
                : !string.IsNullOrWhiteSpace(raw.Intent)
                    ? raw.Intent
                    : $"case #{index + 1}";

            if (string.IsNullOrEmpty(raw.Term))
            {
                throw new InvalidDataException($"The search oracle case '{label}' in '{path}' has an empty (or missing) term.");
            }

            if (raw.MinResults < 0 || raw.MaxResults < 0)
            {
                throw new InvalidDataException($"The search oracle case '{label}' in '{path}' has a negative result bound.");
            }

            if (raw.MinResults > raw.MaxResults)
            {
                throw new InvalidDataException(
                    $"The search oracle case '{label}' in '{path}' has MinResults ({raw.MinResults}) greater than MaxResults ({raw.MaxResults}).");
            }

            return new SearchOracleCase(
                raw.Term,
                raw.Intent ?? string.Empty,
                raw.ExpectedPaths ?? [],
                raw.MustNotMatch ?? [],
                raw.MinResults,
                raw.MaxResults);
        }

        private sealed record RawDocument(int Version, string? Notes, RawCollection? Collection, List<RawCase>? Cases);

        private sealed record RawCollection(string? DeviceId, string? StorageType, int FileCount, string? MetadataSource);

        private sealed record RawCase(
            string? Term,
            string? Intent,
            List<string>? ExpectedPaths,
            List<string>? MustNotMatch,
            int MinResults,
            int MaxResults);
    }
}
