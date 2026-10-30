using System.Reflection;
using System.Text.Json;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Themes;

/// <summary>
/// Reads the shipped themes from the Assets folder beside the program (read-only, never copied into the home, so they
/// are present whatever version marker the home holds), keeps custom themes one JSON file each under System, and keeps
/// the colors last applied to each device in one records file. Every public method runs under one lock, and a write
/// goes to a temp file that then replaces the target, so a failed write keeps the old file.
/// A file that cannot be read, holds invalid colors, or whose stored id does not match its name is warned about, left in place and skipped.
/// </summary>
public class ThemeStore(ILoggingService log) : IThemeStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private static string DataPath => Assembly.GetExecutingAssembly().GetDataPath();
    private static string ShippedPath => Path.Combine(Assembly.GetExecutingAssembly().GetPath(), ThemePaths.ShippedFolder);
    private static string CustomPath => Path.Combine(DataPath, ThemePaths.CustomFolder);
    private static string DeviceRecordsPath => Path.Combine(DataPath, ThemePaths.DeviceRecordsFile);

    private readonly object _lock = new();

    public IReadOnlyList<Theme> ListThemes()
    {
        lock (_lock)
        {
            return LoadShipped()
                .Concat(LoadCustom().OrderBy(t => t.Name, StringComparer.OrdinalIgnoreCase).ThenBy(t => t.Id, StringComparer.Ordinal))
                .ToList();
        }
    }

    public Theme? GetTheme(string themeId)
    {
        RequireThemeId(themeId);
        lock (_lock)
        {
            return ReadTheme(ShippedFilePath(themeId), themeId, ThemeKind.Shipped)
                ?? ReadTheme(CustomFilePath(themeId), themeId, ThemeKind.Custom);
        }
    }

    public ThemeSaveResult CreateCustom(string name, DeviceThemePart device)
    {
        var normalized = RequireName(name);
        RequireColors(device);
        lock (_lock)
        {
            if (IsNameTaken(normalized, exceptId: null)) return new ThemeSaveResult(ThemeSaveStatus.NameTaken);

            var shippedIds = LoadShipped().Select(t => t.Id).ToHashSet(StringComparer.Ordinal);
            var id = ThemeIds.FromName(normalized, candidate => shippedIds.Contains(candidate) || File.Exists(CustomFilePath(candidate)));
            return SaveCustom(id, normalized, device);
        }
    }

    public ThemeSaveResult UpdateCustom(string themeId, string name, DeviceThemePart device)
    {
        RequireThemeId(themeId);
        var normalized = RequireName(name);
        RequireColors(device);
        lock (_lock)
        {
            if (IsShipped(themeId)) return new ThemeSaveResult(ThemeSaveStatus.ShippedReadOnly);
            if (!File.Exists(CustomFilePath(themeId))) return new ThemeSaveResult(ThemeSaveStatus.NotFound);
            if (IsNameTaken(normalized, exceptId: themeId)) return new ThemeSaveResult(ThemeSaveStatus.NameTaken);

            return SaveCustom(themeId, normalized, device);
        }
    }

    public ThemeDeleteStatus DeleteCustom(string themeId)
    {
        RequireThemeId(themeId);
        lock (_lock)
        {
            if (IsShipped(themeId)) return ThemeDeleteStatus.ShippedReadOnly;

            var path = CustomFilePath(themeId);
            if (!File.Exists(path)) return ThemeDeleteStatus.NotFound;

            try
            {
                File.Delete(path);
                return ThemeDeleteStatus.Deleted;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                log.InternalError($"Failed to delete the theme file '{path}': {ex.Message}");
                return ThemeDeleteStatus.Failed;
            }
        }
    }

    public DeviceThemeRecord? GetDeviceRecord(string deviceId)
    {
        RequireDeviceId(deviceId);
        lock (_lock)
        {
            var entry = ReadDeviceRecords().GetValueOrDefault(deviceId);
            if (entry?.Colors is null) return null;
            if (!entry.Colors.IsValid())
            {
                log.InternalWarning($"The theme record for device '{deviceId}' in '{DeviceRecordsPath}' holds invalid colors. Ignoring it.");
                return null;
            }
            return new DeviceThemeRecord(deviceId, entry.Colors, entry.ThemeId, entry.AppliedAt);
        }
    }

    public bool SaveDeviceRecord(DeviceThemeRecord record)
    {
        RequireDeviceId(record.DeviceId);
        RequireColors(record.Colors);
        lock (_lock)
        {
            var records = new Dictionary<string, DeviceRecordEntry>(ReadDeviceRecords(), StringComparer.Ordinal)
            {
                [record.DeviceId] = new DeviceRecordEntry { Colors = record.Colors, ThemeId = record.ThemeId, AppliedAt = record.AppliedAt }
            };
            return Write(DeviceRecordsPath, new DeviceRecordsFile { Records = records }, "device theme records");
        }
    }

    private static void RequireThemeId(string? themeId)
    {
        if (!ThemeIds.IsValid(themeId)) throw new ArgumentException("A theme id is lowercase letters and digits joined by single hyphens, at most 48 characters.", nameof(themeId));
    }

    private static void RequireDeviceId(string? deviceId)
    {
        if (!deviceId.IsValidDeviceId()) throw new ArgumentException("A device id is 1 to 32 letters, digits, '_' or '-'.", nameof(deviceId));
    }

    private static string RequireName(string? name)
    {
        if (!DeviceNameRules.TryNormalize(name, out var normalized)) throw new ArgumentException("A theme name is 1 to 24 characters with no control characters.", nameof(name));
        return normalized;
    }

    private static void RequireColors(DeviceThemePart? device)
    {
        if (device is null || !device.IsValid()) throw new ArgumentException("Every color must be 0 to 15.", nameof(device));
    }

    private static string ShippedFilePath(string themeId) => Path.Combine(ShippedPath, themeId + ThemePaths.Extension);

    private static string CustomFilePath(string themeId) => Path.Combine(CustomPath, themeId + ThemePaths.Extension);

    private bool IsShipped(string themeId) => LoadShipped().Any(t => t.Id == themeId);

    private bool IsNameTaken(string name, string? exceptId) =>
        LoadShipped().Concat(LoadCustom())
            .Any(t => t.Id != exceptId && string.Equals(t.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));

    private ThemeSaveResult SaveCustom(string id, string name, DeviceThemePart device)
    {
        var file = new ThemeFile { Id = id, Name = name, Parts = new ThemePartsFile { Device = device } };
        if (!Write(CustomFilePath(id), file, "theme")) return new ThemeSaveResult(ThemeSaveStatus.Failed);

        return new ThemeSaveResult(ThemeSaveStatus.Saved, new Theme(id, name, ThemeKind.Custom, new ThemeParts { Device = device }));
    }

    /// <summary>
    /// The shipped themes by sort order; a file without a sort order goes last.
    /// </summary>
    private List<Theme> LoadShipped() =>
        ReadFolder(ShippedPath, ThemeKind.Shipped)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Theme.Id, StringComparer.Ordinal)
            .Select(t => t.Theme)
            .ToList();

    private List<Theme> LoadCustom() => ReadFolder(CustomPath, ThemeKind.Custom).Select(t => t.Theme).ToList();

    private List<(Theme Theme, int SortOrder)> ReadFolder(string folder, ThemeKind kind)
    {
        var themes = new List<(Theme, int)>();
        string[] files;
        try
        {
            files = Directory.Exists(folder) ? Directory.GetFiles(folder, "*" + ThemePaths.Extension) : [];
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            log.InternalWarning($"The themes folder '{folder}' could not be listed ({ex.Message}).");
            return themes;
        }

        foreach (var file in files)
        {
            var id = Path.GetFileNameWithoutExtension(file);
            if (!ThemeIds.IsValid(id) || !string.Equals(Path.GetExtension(file), ThemePaths.Extension, StringComparison.Ordinal)) continue;

            var theme = ReadTheme(file, id, kind, out var sortOrder);
            if (theme is not null) themes.Add((theme, sortOrder));
        }
        return themes;
    }

    private Theme? ReadTheme(string path, string themeId, ThemeKind kind) => ReadTheme(path, themeId, kind, out _);

    private Theme? ReadTheme(string path, string themeId, ThemeKind kind, out int sortOrder)
    {
        sortOrder = int.MaxValue;
        var file = Read<ThemeFile>(path, "theme", f =>
            f.Id == themeId
            && DeviceNameRules.TryNormalize(f.Name, out _)
            && f.Parts?.Device is { } device
            && device.IsValid());
        if (file is null) return null;

        DeviceNameRules.TryNormalize(file.Name, out var name);
        sortOrder = file.SortOrder ?? int.MaxValue;
        return new Theme(themeId, name, kind, new ThemeParts { Device = file.Parts!.Device! });
    }

    private Dictionary<string, DeviceRecordEntry> ReadDeviceRecords() =>
        Read<DeviceRecordsFile>(DeviceRecordsPath, "device theme records", f => f.Records is not null)?.Records
        ?? new Dictionary<string, DeviceRecordEntry>(StringComparer.Ordinal);

    /// <summary>
    /// Reads a document: null when the file is missing, or unreadable, unparsable or rejected by <paramref name="isValid"/> (warned about once).
    /// </summary>
    private T? Read<T>(string path, string what, Func<T, bool> isValid) where T : class
    {
        if (!File.Exists(path)) return null;

        try
        {
            var document = JsonSerializer.Deserialize<T>(File.ReadAllText(path), JsonOptions);
            if (document is not null && isValid(document)) return document;

            log.InternalWarning($"The {what} file '{path}' is empty, holds invalid values or does not match its name. Ignoring it.");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
        {
            log.InternalWarning($"The {what} file '{path}' could not be read ({ex.Message}). Ignoring it.");
        }
        return null;
    }

    /// <summary>
    /// Writes to a temp file and moves it over the target. On failure the old file is kept and the temp file removed.
    /// </summary>
    private bool Write<T>(string path, T document, string what)
    {
        var tempPath = $"{path}.{Guid.NewGuid():N}.tmp";

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(tempPath, JsonSerializer.Serialize(document, JsonOptions));
            File.Move(tempPath, path, overwrite: true);
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            log.InternalError($"Failed to save the {what} to '{path}': {ex.Message}");
            TryDelete(tempPath);
            return false;
        }
    }

    private void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            log.InternalWarning($"Could not remove the temporary file '{path}': {ex.Message}");
        }
    }
}
