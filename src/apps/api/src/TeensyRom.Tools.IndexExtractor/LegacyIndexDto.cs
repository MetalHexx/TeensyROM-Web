namespace TeensyRom.Tools.IndexExtractor;

/// <summary>
/// The only shape of the legacy index JSON the extractor knows about. Every other property present in the
/// source file (descriptions, checksums, timestamps, a "Type" discriminator, etc.) is left unmapped so
/// System.Text.Json skips it during streaming deserialization rather than materializing it.
/// </summary>
sealed class LegacyDirDto
{
    public List<LegacyFileDto>? Files { get; set; }
}

sealed class LegacyFileDto
{
    public string? Path { get; set; }
    public string? Name { get; set; }
    public long Size { get; set; }
}
