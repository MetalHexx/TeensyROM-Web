using TeensyRom.Api.Transfers;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferJobRegistryTests
{
    private static ITransferJobRegistry NewRegistry() => new TransferJobRegistry();

    [Fact]
    public void Create_AddsJob_RetrievableByGet()
    {
        var registry = NewRegistry();

        var job = registry.Create("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"));

        registry.Get(job.JobId).Should().BeSameAs(job);
    }

    [Fact]
    public void Get_UnknownJobId_ReturnsNull() =>
        NewRegistry().Get("missing").Should().BeNull();

    [Fact]
    public void GetActive_NonTerminalJob_ReturnsJob()
    {
        var registry = NewRegistry();
        var job = registry.Create("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"));

        registry.GetActive("device-1").Should().BeSameAs(job);
    }

    [Fact]
    public void GetActive_TerminalJob_ReturnsNull()
    {
        var registry = NewRegistry();
        var job = registry.Create("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"));
        job.TryTransitionTo(TransferJobState.Cancelling);
        job.TryTransitionTo(TransferJobState.Cancelled);

        registry.GetActive("device-1").Should().BeNull();
    }

    [Fact]
    public void GetActive_UnknownDevice_ReturnsNull() =>
        NewRegistry().GetActive("no-such-device").Should().BeNull();

    [Fact]
    public void All_ReturnsEveryRegisteredJob()
    {
        var registry = NewRegistry();
        var jobA = registry.Create("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"));
        var jobB = registry.Create("device-2", TeensyStorageType.USB, new DirectoryPath("/transfers"));

        registry.All().Should().BeEquivalentTo([jobA, jobB]);
    }

    [Fact]
    public void Remove_DropsJob_NoLongerRetrievable()
    {
        var registry = NewRegistry();
        var job = registry.Create("device-1", TeensyStorageType.SD, new DirectoryPath("/transfers"));

        registry.Remove(job.JobId);

        registry.Get(job.JobId).Should().BeNull();
    }
}
