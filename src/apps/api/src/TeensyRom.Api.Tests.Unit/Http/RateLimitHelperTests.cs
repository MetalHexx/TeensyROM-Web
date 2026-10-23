using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using TeensyRom.Api.Http;

namespace TeensyRom.Api.Tests.Unit.Http;

public class RateLimitHelperTests
{
    private static HttpContext ContextWith(string? query) => new DefaultHttpContext
    {
        Request = { QueryString = query is null ? QueryString.Empty : new QueryString(query) }
    };

    [Theory]
    [InlineData("?fullScan=true")]
    [InlineData("?FullScan=true")]
    public void FullScan_AllowsOneInTheWindow(string query)
    {
        var partition = RateLimitHelper.FindDevicesPartition(ContextWith(query));
        using var limiter = partition.Factory(partition.PartitionKey);

        using var first = limiter.AttemptAcquire();
        using var second = limiter.AttemptAcquire();

        first.IsAcquired.Should().BeTrue();
        second.IsAcquired.Should().BeFalse();
    }

    [Theory]
    [InlineData("?fullScan=false")]
    [InlineData(null)]
    public void PlainListing_IsNeverLimited(string? query)
    {
        var partition = RateLimitHelper.FindDevicesPartition(ContextWith(query));
        using var limiter = partition.Factory(partition.PartitionKey);

        for (var i = 0; i < 10; i++)
        {
            using var lease = limiter.AttemptAcquire();
            lease.IsAcquired.Should().BeTrue();
        }
    }

    /// <summary>
    /// Three overlapping full scans: the first takes the window's permit, the second queues, and the third queues
    /// in its place, so the second is turned away. The third stays queued until the test cancels it.
    /// </summary>
    [Fact]
    public async Task FindDevicesPolicy_AsRegistered_LimitsOverlappingFullScansButNotListings()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddStrictRateLimiting();
        await using var app = builder.Build();
        app.UseRateLimiter();
        app.MapGet("/devices", () => "ok").RequireRateLimiting(RateLimitHelper.FindDevicesRateLimiter);
        await app.StartAsync();
        using var client = app.GetTestClient();
        using var stillQueued = new CancellationTokenSource();
        var timeout = TimeSpan.FromSeconds(3);

        var scans = Enumerable.Range(0, 3).Select(_ => client.GetAsync("/devices?fullScan=true", stillQueued.Token)).ToList();
        var listings = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => client.GetAsync("/devices")).ToList()).WaitAsync(timeout);

        var answered = new List<HttpStatusCode>();
        for (var i = 0; i < 2; i++)
        {
            var done = await Task.WhenAny(scans).WaitAsync(timeout);
            scans.Remove(done);
            answered.Add((await done).StatusCode);
        }
        stillQueued.Cancel();

        answered.Should().BeEquivalentTo([HttpStatusCode.OK, HttpStatusCode.ServiceUnavailable]);
        listings.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
        await app.StopAsync();
    }
}
