using System.Text;
using System.Text.Json;
using TeensyRom.Tools.IndexExtractor;

ExtractorOptions options;

try
{
    options = ExtractorOptions.Parse(args);
}
catch (ArgumentException ex)
{
    Console.Error.WriteLine(ex.Message);
    Console.Error.WriteLine(ExtractorOptions.Usage);
    return 1;
}

var jsonOptions = new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true,
    DefaultBufferSize = 1 << 20
};

Dictionary<string, LegacyDirDto>? index;

await using (var input = File.OpenRead(options.InputPath))
{
    index = await JsonSerializer.DeserializeAsync<Dictionary<string, LegacyDirDto>>(input, jsonOptions);
}

if (index is null)
{
    Console.Error.WriteLine("The input file did not contain a JSON object.");
    return 1;
}

var records = new List<(string Path, string Name, long Size)>();
var droppedCount = 0;

foreach (var dir in index.Values)
{
    if (dir.Files is null)
    {
        continue;
    }

    foreach (var file in dir.Files)
    {
        var path = file.Path;
        var name = file.Name;

        if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(name)
            || ContainsTabOrNewline(path) || ContainsTabOrNewline(name))
        {
            droppedCount++;
            continue;
        }

        records.Add((path, name, file.Size));
    }
}

var utf8NoBom = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);

await using (var writer = new StreamWriter(options.OutputPath, append: false, utf8NoBom) { NewLine = "\n" })
{
    writer.WriteLine(
        $"#teensyrom-index-fixture\tv1\tdevice={options.DeviceId}\tstorage={options.StorageType}\tfiles={records.Count}");

    foreach (var record in records)
    {
        writer.WriteLine($"{record.Path}\t{record.Name}\t{record.Size}");
    }
}

Console.Error.WriteLine(
    $"Wrote {records.Count} records to {options.OutputPath}; dropped {droppedCount} record(s) with an embedded tab or newline.");

return 0;

static bool ContainsTabOrNewline(string value) => value.Contains('\t') || value.Contains('\n') || value.Contains('\r');
