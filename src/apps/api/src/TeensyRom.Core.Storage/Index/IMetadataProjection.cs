namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// Populates <c>content_metadata</c> once per distinct content identity by re-running local enrichment
    /// against a single representative file — never once per file, since every copy of the same content
    /// shares one metadata row.
    /// </summary>
    public interface IMetadataProjection
    {
        /// <summary>
        /// Projects every distinct content identity in <paramref name="scope"/> that has no row, or whose row
        /// carries a different source version. Returns the number of rows written.
        /// </summary>
        Task<int> ProjectAsync(IndexScope scope, IProgress<int>? progress, CancellationToken ct);
    }
}
