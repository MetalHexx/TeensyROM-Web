using System.Text.Json;

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
    /// Loads the committed search oracle: a small, human-edited set of real search terms and the bounds a
    /// correct search must satisfy against them.
    /// </summary>
    public static class SearchOracle
    {
        private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };

        /// <summary>
        /// Reads and validates the oracle at <paramref name="path"/>. A malformed case — an empty (or
        /// missing) term, a negative bound, or a minimum above its maximum — throws naming that case rather
        /// than being silently skipped, which would otherwise pass for the wrong reason.
        /// </summary>
        public static IReadOnlyList<SearchOracleCase> Load(string path)
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

            return cases;
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

        private sealed record RawDocument(int Version, string? Notes, List<RawCase>? Cases);

        private sealed record RawCase(
            string? Term,
            string? Intent,
            List<string>? ExpectedPaths,
            List<string>? MustNotMatch,
            int MinResults,
            int MaxResults);
    }
}
