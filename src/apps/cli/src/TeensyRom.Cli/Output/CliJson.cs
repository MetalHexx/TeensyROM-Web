using System.Text.Json;
using System.Text.Json.Serialization;

namespace TeensyRom.Cli.Output;

/// <summary>The JSON dialect of every <c>--json</c> document: camelCase, string enums, no nulls.</summary>
internal static class CliJson
{
    public static JsonSerializerOptions Indented { get; } = Create(indented: true);

    /// <summary>For documents that must stay on one line, such as the JSON error object.</summary>
    public static JsonSerializerOptions Compact { get; } = Create(indented: false);

    private static JsonSerializerOptions Create(bool indented) => new(JsonSerializerDefaults.Web)
    {
        WriteIndented = indented,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };
}
