using System.Text.Json;
using System.Text.Json.Nodes;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.File;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Storage.Entities;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

public sealed class FileItemJsonTests
{
    internal static FileItemDto SongDto(string path = "/music/Commando.sid") => new()
    {
        Name = path[(path.LastIndexOf('/') + 1)..],
        Path = path,
        Size = 4096,
        StorageType = TeensyRom.Cli.Api.Generated.TeensyStorageType.USB,
        IsCompatible = true,
        Title = "Commando",
        Creator = "Rob Hubbard",
        ReleaseInfo = "1985 Elite",
        Description = "A classic.",
        ShareUrl = "https://example.test/commando",
        MetadataSource = "HVSC",
        Meta1 = "Meta one",
        Meta2 = "Meta two",
        MetadataSourcePath = "/hvsc/Commando.sid",
        ParentPath = "/music",
        PlayLength = "00:03:20",
        SubtuneLengths = ["00:03:20", "00:01:00"],
        StartSubtuneNum = 1,
        RatingCount = 3,
        Type = FileItemType.Song,
        Links = [new FileLinkDto { Name = "CSDb", Url = "https://csdb.test/1" }],
        Competitions = [new CompetitionDto { Name = "Party", Place = 2 }]
    };

    private static JsonObject Full(IFileItem item, TeensyStorageType storage = TeensyStorageType.SD) =>
        FileItemJson.Full(item, storage);

    private static readonly string[] MappedFields =
        ["description", "playLength", "subtuneLengths", "startSubtuneNum", "links", "tags", "youTubeVideos", "competitions", "ratingCount", "images", "metadataSource", "meta1", "meta2", "parentPath", "type"];

    [Fact]
    public void Full_OfAMappedAndClonedSong_KeepsTheEnginesRecord()
    {
        var item = ApiMapper.ToFileItem(SongDto()).Clone();

        var full = Full(item);

        foreach (var field in MappedFields) full.ContainsKey(field).Should().BeTrue(field);
        full["description"]!.GetValue<string>().Should().Be("A classic.");
        full["playLength"]!.GetValue<string>().Should().Be("00:03:20");
        full["type"]!.GetValue<string>().Should().Be("song");
        full["links"]!.AsArray().Should().HaveCount(1);
        full["competitions"]![0]!["place"]!.GetValue<int>().Should().Be(2);
        full.ContainsKey("avgRating").Should().BeFalse();
    }

    [Fact]
    public void Full_OverlaysOnlyWhatTheCliOwns_AndNeverWritesStorageType()
    {
        var dto = SongDto();
        var item = ApiMapper.ToFileItem(dto);
        item.IsCompatible = false;

        var full = Full(item, TeensyStorageType.USB);

        full.ContainsKey("storageType").Should().BeFalse();
        full["storage"]!.GetValue<string>().Should().Be("usb");
        full["fileType"]!.GetValue<string>().Should().Be("sid");
        full["isCompatible"]!.GetValue<bool>().Should().BeFalse();
        full["creator"]!.GetValue<string>().Should().Be("Rob Hubbard");
        full["releaseInfo"]!.GetValue<string>().Should().Be("1985 Elite");
    }

    [Fact]
    public void Full_ForAGameCarriesTheEnginesCreator_WhileTheCompactFormKeepsTheTypeLabel()
    {
        var dto = new FileItemDto { Name = "Zaxxon.prg", Path = "/games/Zaxxon.prg", Creator = "Sega", Type = FileItemType.Game };
        var item = ApiMapper.ToFileItem(dto);

        Full(item)["creator"]!.GetValue<string>().Should().Be("Sega");
        FileItemJson.From(item, TeensyStorageType.SD).Creator.Should().Be("Program File");
    }

    [Fact]
    public void Full_WithoutAnApiRecord_FallsBackToTheCompactForm()
    {
        var item = new SongItem { Name = "a.sid", Path = "/a.sid", PlayLength = TimeSpan.FromSeconds(200) };

        var full = Full(item);

        full.Select(p => p.Key).Should().Equal(JsonSerializer.SerializeToNode(FileItemJson.From(item, TeensyStorageType.SD), CliJson.Indented)!.AsObject().Select(p => p.Key));
        full["playLength"]!.GetValue<string>().Should().Be("00:03:20");
    }

    [Fact]
    public void Compact_AddsOnlyPlayLength_ToTheExistingShape()
    {
        var item = ApiMapper.ToFileItem(SongDto());

        var names = JsonSerializer.SerializeToNode(FileItemJson.From(item, TeensyStorageType.SD), CliJson.Indented)!.AsObject().Select(p => p.Key);

        names.Should().Equal("name", "path", "storage", "fileType", "size", "isFavorite", "isCompatible", "title", "creator", "releaseInfo", "shareUrl", "playLength");
        FileItemJson.From(item, TeensyStorageType.SD).PlayLength.Should().Be("00:03:20");
    }

    [Fact]
    public void Compact_PlayLength_IsOmittedForFilesWithoutOne()
    {
        FileItemJson.From(new HexItem { Name = "fw.hex", Path = "/fw.hex" }, TeensyStorageType.SD).PlayLength.Should().BeNull();
        FileItemJson.From(ApiMapper.ToFileItem(new FileItemDto { Name = "x.txt", Path = "/x.txt", Type = FileItemType.Unknown }), TeensyStorageType.SD).PlayLength.Should().BeNull();
    }

    [Theory]
    [InlineData(FileItemType.Song)]
    [InlineData(FileItemType.Game)]
    [InlineData(FileItemType.Image)]
    [InlineData(FileItemType.Hex)]
    public void EveryItemType_KeepsTheRecordThroughClone(FileItemType type)
    {
        var dto = new FileItemDto { Name = "x.bin", Path = "/x.bin", Type = type };

        ApiMapper.ToFileItem(dto).Clone().ApiRecord.Should().BeSameAs(dto);
    }
}
