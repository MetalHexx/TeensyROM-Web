using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class DeviceLeaseCoordinatorTests
{
    private static IDeviceLeaseCoordinator NewCoordinator() => new DeviceLeaseCoordinator();

    [Fact]
    public void TryAcquire_UnheldDevice_ReturnsTrue()
    {
        var coordinator = NewCoordinator();

        coordinator.TryAcquire("device-1", "job-1").Should().BeTrue();
        coordinator.GetHolder("device-1").Should().Be("job-1");
    }

    [Fact]
    public void TryAcquire_AlreadyHeldByAnotherJob_ReturnsFalse()
    {
        var coordinator = NewCoordinator();
        coordinator.TryAcquire("device-1", "job-1");

        coordinator.TryAcquire("device-1", "job-2").Should().BeFalse();
        coordinator.GetHolder("device-1").Should().Be("job-1");
    }

    [Fact]
    public void TryAcquire_DifferentDevice_ReturnsTrue()
    {
        var coordinator = NewCoordinator();
        coordinator.TryAcquire("device-1", "job-1");

        coordinator.TryAcquire("device-2", "job-2").Should().BeTrue();
    }

    [Fact]
    public void TryAcquire_SameHolderReacquires_ReturnsTrue()
    {
        var coordinator = NewCoordinator();
        coordinator.TryAcquire("device-1", "job-1");

        coordinator.TryAcquire("device-1", "job-1").Should().BeTrue();
    }

    [Fact]
    public void Release_ByHolder_ClearsLease()
    {
        var coordinator = NewCoordinator();
        coordinator.TryAcquire("device-1", "job-1");

        coordinator.Release("device-1", "job-1");

        coordinator.GetHolder("device-1").Should().BeNull();
    }

    [Fact]
    public void Release_ByNonHolder_LeavesLeaseIntact()
    {
        var coordinator = NewCoordinator();
        coordinator.TryAcquire("device-1", "job-1");

        coordinator.Release("device-1", "job-2");

        coordinator.GetHolder("device-1").Should().Be("job-1");
    }

    [Fact]
    public void GetHolder_UnheldDevice_ReturnsNull() =>
        NewCoordinator().GetHolder("device-1").Should().BeNull();

    [Fact]
    public async Task TryAcquire_ManyParallelCallsForOneDevice_YieldsExactlyOneWinner()
    {
        var coordinator = NewCoordinator();
        var jobIds = Enumerable.Range(0, 50).Select(i => $"job-{i}").ToArray();

        var results = await Task.WhenAll(jobIds.Select(jobId =>
            Task.Run(() => coordinator.TryAcquire("device-1", jobId))));

        results.Count(won => won).Should().Be(1);
    }
}
