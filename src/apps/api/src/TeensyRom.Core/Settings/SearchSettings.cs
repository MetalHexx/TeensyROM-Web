namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Search behavior, filtering, and content exclusion preferences
  /// </summary>
  public record SearchSettings
  {
    public SearchWeights SearchWeights { get; set; } = new();
    public List<string> SearchStopWords { get; set; } = 
    [
      "a", "an", "and", "are", "as", "at", "be", "but", "by", "for",
      "if", "in", "is", "it", "no", "not", "of", "on", "or", "that",
      "the", "to", "was", "with"
    ];
    public List<string> BannedDirectories { get; set; } = 
    [
      "MUSICIANS/S/Szachista", "System Volume Information", "FOUND.000",
      "integration-test-files", "integration-tests", "AlternativeFormats",
      "Dumps", "Docs"
    ];
    public List<string> BannedFiles { get; set; } = 
    [
      "Revolutionary_Etude_part_1.sid", "Revolutionary_Etude_part_2.sid",
      "Super_Trouper.sid"
    ];
  }
}
