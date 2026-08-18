namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// Turns a free-text search term into an FTS5 MATCH expression. A search term is not a MATCH expression:
    /// bare <c>"</c>, <c>*</c>, <c>-</c>, <c>^</c>, <c>:</c>, <c>AND</c>/<c>OR</c>/<c>NOT</c>, and <c>NEAR</c> are
    /// all operators in FTS5's own grammar, and an unbalanced quote raises a SQL logic error rather than
    /// returning nothing.
    /// </summary>
    internal static class FtsQuery
    {
        /// <summary>
        /// Splits <paramref name="searchText"/> on whitespace, quotes each token so none of it is read as FTS5
        /// grammar, appends a prefix wildcard to the final token, and joins the tokens with an implicit AND.
        /// Returns <see langword="null"/> for empty or whitespace-only input, signalling no results rather than
        /// a MATCH expression that would throw.
        /// </summary>
        public static string? Build(string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
            {
                return null;
            }

            var tokens = searchText.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);

            if (tokens.Length == 0)
            {
                return null;
            }

            var quoted = tokens.Select(QuoteToken).ToArray();
            quoted[^1] += "*";

            return string.Join(" ", quoted);
        }

        private static string QuoteToken(string token) => $"\"{token.Replace("\"", "\"\"")}\"";
    }
}
