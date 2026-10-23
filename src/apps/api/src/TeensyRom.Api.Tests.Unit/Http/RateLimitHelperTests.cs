using Microsoft.AspNetCore.Http;
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
}
