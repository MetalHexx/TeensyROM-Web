using System.Net;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The hand-written streaming upload, over a stubbed HTTP handler so the request that goes out is the real one.
/// </summary>
public sealed class UploadClientTests
{
    private sealed record Sent(HttpMethod Method, Uri Uri, string? ContentType, long? ContentLength, byte[] Body);

    private static async Task<Sent> CaptureAsync(HttpRequestMessage request) => new(
        request.Method,
        request.RequestUri!,
        request.Content!.Headers.ContentType?.MediaType,
        request.Content.Headers.ContentLength,
        await request.Content.ReadAsByteArrayAsync());

    [Fact]
    public async Task Upload_PostsTheRawBytes_ToTheEscapedJobAndPath()
    {
        var bytes = new byte[] { 0x01, 0x08, 0x0B, 0x08, 0xFF, 0x00, 0x42 };
        Sent? sent = null;
        var client = ApiTestSupport.ClientWith(async request =>
        {
            sent = await CaptureAsync(request);
            return ApiTestSupport.Reply(HttpStatusCode.OK, """{"relativePath":"my games/a&b.prg","sizeBytes":7,"queued":true}""");
        });

        var response = await client.UploadTransferFileContentAsync("job 1", "my games/a&b.prg", new MemoryStream(bytes), bytes.Length);

        sent.Should().NotBeNull();
        sent!.Method.Should().Be(HttpMethod.Post);
        sent.Uri.AbsolutePath.Should().Be("/api/transfers/job%201/files");
        sent.Uri.Query.Should().Be("?Path=my%20games%2Fa%26b.prg");
        sent.ContentType.Should().Be("application/octet-stream");
        sent.ContentLength.Should().Be(bytes.Length);
        sent.Body.Should().Equal(bytes);
        response.RelativePath.Should().Be("my games/a&b.prg");
        response.SizeBytes.Should().Be(7);
        response.Queued.Should().BeTrue();
    }

    [Fact]
    public async Task Upload_OfAnEmptyFile_SendsAZeroLengthBody()
    {
        Sent? sent = null;
        var client = ApiTestSupport.ClientWith(async request =>
        {
            sent = await CaptureAsync(request);
            return ApiTestSupport.Reply(HttpStatusCode.OK, """{"relativePath":"empty.bin","sizeBytes":0,"queued":true}""");
        });

        await client.UploadTransferFileContentAsync("job", "empty.bin", Stream.Null, 0);

        sent!.ContentLength.Should().Be(0);
        sent.Body.Should().BeEmpty();
    }

    [Fact]
    public async Task Upload_Refused400WithAProblemDetails_BecomesATeensyApiExceptionCarryingItsTitle()
    {
        var client = ApiTestSupport.ClientAnswering(HttpStatusCode.BadRequest, """{"title":"The path is not usable.","status":400}""");

        var act = () => ApiErrors.Call(() => client.UploadTransferFileContentAsync("job", "bad", new MemoryStream([1]), 1));

        var error = (await act.Should().ThrowAsync<TeensyApiException>()).Which;
        error.StatusCode.Should().Be(400);
        error.Message.Should().Be("The path is not usable.");
    }

    [Fact]
    public async Task Upload_RefusedWithOnlyADetail_UsesTheDetail()
    {
        var client = ApiTestSupport.ClientAnswering(HttpStatusCode.BadRequest, """{"detail":"Job j is not accepting files in its current state (Aborted)."}""");

        var act = () => ApiErrors.Call(() => client.UploadTransferFileContentAsync("j", "a.sid", new MemoryStream([1]), 1));

        (await act.Should().ThrowAsync<TeensyApiException>()).Which.Message.Should().Be("Job j is not accepting files in its current state (Aborted).");
    }

    [Fact]
    public async Task Upload_ToAJobTheEngineDoesNotKnow_IsANotFound()
    {
        var client = ApiTestSupport.ClientAnswering(HttpStatusCode.NotFound, """{"title":"No transfer job was found with id j."}""");

        var act = () => ApiErrors.Call(() => client.UploadTransferFileContentAsync("j", "a.sid", new MemoryStream([1]), 1));

        var error = (await act.Should().ThrowAsync<TeensyApiException>()).Which;
        error.StatusCode.Should().Be(404);
        error.Message.Should().Be("No transfer job was found with id j.");
    }

    [Fact]
    public async Task Upload_WhenTheEngineIsGone_IsATeensyApiExceptionWithNoStatus()
    {
        var client = ApiTestSupport.ClientWith(_ => throw new HttpRequestException("refused"));

        var act = () => ApiErrors.Call(() => client.UploadTransferFileContentAsync("j", "a.sid", new MemoryStream([1]), 1));

        (await act.Should().ThrowAsync<TeensyApiException>()).Which.StatusCode.Should().BeNull();
    }
}
