using Spectre.Console;
using Spectre.Console.Rendering;
using System.Globalization;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Output;

/// <summary>
/// The player's "Now Playing" panel: every fact tr-web knows about a file, in the order the web app's description panel shows them.
/// </summary>
/// <remarks>
/// Facts come from <see cref="IFileItem.ApiRecord"/> when the item has one, else from the item's own fields. All metadata is
/// rendered as sanitized plain text, never parsed as markup.
/// </remarks>
internal static class FileDetailsPanel
{
    public static IRenderable Build(IFileItem item)
    {
        var record = item.ApiRecord;
        var isSong = record is not null ? record.Type == FileItemType.Song : item is SongItem;

        var title = record?.Title ?? item.Title;
        var details = new List<IRenderable> { Text.Empty };

        AddFact(details, "Creator", record?.Creator ?? item.Creator);
        AddFact(details, "Release", record?.ReleaseInfo ?? item.ReleaseInfo);
        AddFact(details, "Length", record?.PlayLength ?? (item as SongItem)?.PlayLength.ToString());

        if (isSong)
        {
            AddFact(details, "SID", record?.Meta2 ?? item.Meta2);
            AddFact(details, "Clock", record?.Meta1 ?? item.Meta1);
        }

        if (record is not null) AddRecordSections(details, record);

        details.Add(new Text($"Path: {TerminalText.Sanitize(item.Path)}"));
        details.Add(new Text($"Favorite: {(item.IsFavorite ? "Yes" : "No")}"));
        details.Add(Text.Empty);

        var panel = new Panel(new Rows(details))
            .Header($" Now Playing: {Markup.Escape(OneLine(title))} ".AddHighlights())
            .PadLeft(3)
            .BorderColor(RadHelper.Theme.Secondary.Color)
            .Border(BoxBorder.Rounded)
            .Expand();

        var description = TerminalText.Sanitize(record?.Description ?? item.Description).Trim();

        if (description.Length == 0) return panel;

        var descriptionPanel = new Panel(new Rows(Text.Empty, new Text(description), Text.Empty))
            .Header(isSong ? " SID Comments ".AddSecondaryColor() : " Description ".AddSecondaryColor())
            .PadLeft(3)
            .BorderColor(RadHelper.Theme.Primary.Color)
            .Border(BoxBorder.Rounded)
            .Expand();

        return new Rows(panel, descriptionPanel);
    }

    private static void AddRecordSections(List<IRenderable> details, FileItemDto record)
    {
        if (record.AvgRating is { } rating)
        {
            details.Add(new Text($"Rating: {rating.ToString("0.0", CultureInfo.InvariantCulture)} ({record.RatingCount} ratings)"));
        }

        var tags = record.Tags.Select(tag => TerminalText.Sanitize(tag.Name)).Where(name => name.Length > 0).ToList();
        if (tags.Count > 0) details.Add(new Text($"Tags: {string.Join(", ", tags)}"));

        AddList(details, "Competitions", record.Competitions.Select(competition =>
        {
            var name = TerminalText.Sanitize(competition.Name);
            return (IRenderable)new Text(competition.Place is { } place ? $"{place}. {name}" : name);
        }));

        AddList(details, "Links", record.Links.Select(link => (IRenderable)TerminalText.Link(link.Name, link.Url)));

        AddList(details, "YouTube", record.YouTubeVideos.Select(video => (IRenderable)TerminalText.Link(video.Channel, video.Url)));
    }

    private static void AddFact(List<IRenderable> details, string label, string? value)
    {
        var text = TerminalText.Sanitize(value).Trim();

        if (text.Length > 0) details.Add(new Text($"{label}: {text}"));
    }

    private static void AddList(List<IRenderable> details, string label, IEnumerable<IRenderable> entries)
    {
        var rows = entries.Select(entry => (IRenderable)new Padder(entry, new Padding(2, 0, 0, 0))).ToList();

        if (rows.Count == 0) return;

        details.Add(new Text($"{label}:"));
        details.AddRange(rows);
    }

    private static string OneLine(string? text) =>
        TerminalText.Sanitize(text).Replace('\n', ' ').Replace('\t', ' ').Trim();
}
