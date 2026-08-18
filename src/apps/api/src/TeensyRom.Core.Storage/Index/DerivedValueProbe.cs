using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// Tells real metadata apart from a type's own generated fallback without knowing what any fallback says.
    /// A property such as <see cref="SongItem.Description"/> never returns empty — it falls back to boilerplate
    /// the moment its backing field is empty — so reading it after enrichment can't distinguish "found nothing"
    /// from "found this exact text". Comparing against a second, unenriched instance of the same subtype can.
    /// </summary>
    internal static class DerivedValueProbe
    {
        /// <summary>
        /// True when <paramref name="read"/> returns the same value for <paramref name="enriched"/> and
        /// <paramref name="unenriched"/> — i.e. enrichment did not change what the property reports, so
        /// whatever it currently returns is the type's own derived value rather than real metadata.
        /// </summary>
        internal static bool IsDerived(FileItem enriched, FileItem unenriched, Func<FileItem, string> read) =>
            string.Equals(read(enriched), read(unenriched), StringComparison.Ordinal);
    }
}
