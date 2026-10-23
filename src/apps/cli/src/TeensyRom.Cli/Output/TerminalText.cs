using Spectre.Console;
using System.Text;

namespace TeensyRom.Cli.Output;

/// <summary>
/// Makes text from outside sources (HVSC, DeepSID, CSDb, YouTube) safe to print: control characters are removed and links
/// are built from text and styles, never from markup.
/// </summary>
internal static class TerminalText
{
    /// <summary>Removes C0/C1 control characters (ESC, BEL, CSI 0x9B …) except '\n' and '\t'; null becomes "".</summary>
    public static string Sanitize(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;

        var clean = new StringBuilder(text.Length);

        foreach (var character in text)
        {
            if (character is '\n' or '\t' || !char.IsControl(character)) clean.Append(character);
        }
        return clean.ToString();
    }

    /// <summary>
    /// A renderable for one link: the visible text always includes the address, and it is a hyperlink only for an absolute
    /// http/https URL (Spectre writes the hyperlink escape only to an ANSI console).
    /// </summary>
    public static Paragraph Link(string? label, string url)
    {
        var address = Sanitize(url);
        var name = Sanitize(label);
        var text = string.IsNullOrWhiteSpace(name) ? address : $"{name} — {address}";

        var paragraph = new Paragraph();

        if (TryGetWebUri(address, out var uri)) paragraph.Append(text, new Style(link: uri.AbsoluteUri));
        else paragraph.Append(text);

        return paragraph;
    }

    /// <summary>True for an absolute http or https URL.</summary>
    public static bool IsWebLink(string? url) => TryGetWebUri(Sanitize(url), out _);

    private static bool TryGetWebUri(string url, out Uri uri) =>
        Uri.TryCreate(url, UriKind.Absolute, out uri!) && uri.Scheme is "http" or "https";
}
