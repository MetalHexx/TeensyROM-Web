namespace TeensyRom.Api.Transfers;

/// <summary>
/// The file types the TeensyROM firmware recognizes (DriveDirLoad.h's extension table), archives excluded:
/// archives are recognized by <c>IArchiveReader.IsArchiveExtension</c> and expanded, not transferred.
/// </summary>
public static class TransferableFileTypes
{
    public static IReadOnlySet<string> Extensions { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ".sid", ".crt", ".prg", ".p00", ".hex", ".kla", ".koa", ".art", ".aas", ".hpi", ".seq", ".txt", ".d64",
        ".nfo", ".md", ".ocp", ".pic", ".d71", ".d81", ".reu", ".trh"
    };

    /// <summary>Whether the file at <paramref name="path"/> is of a type the TeensyROM takes, judged by its extension.</summary>
    public static bool IsTransferable(string path) => Extensions.Contains(Path.GetExtension(path));
}
