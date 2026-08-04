using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferCapacityGateTests
{
    [Fact]
    public async Task WaitForSlotAsync_BelowBothCeilings_ReturnsImmediately()
    {
        var gate = NewGate(maxFiles: 5, maxBytes: 1000);

        await gate.WaitForSlotAsync(10, CancellationToken.None);

        gate.Current.Should().Be((1, 10));
    }

    [Fact]
    public async Task WaitForSlotAsync_AtFileCeiling_BlocksThenUnblocksOnRelease()
    {
        var gate = NewGate(maxFiles: 1, maxBytes: 1000);
        await gate.WaitForSlotAsync(10, CancellationToken.None);

        var waiter = gate.WaitForSlotAsync(10, CancellationToken.None);

        var wonRace = await Task.WhenAny(waiter, Task.Delay(TimeSpan.FromMilliseconds(200)));
        wonRace.Should().NotBe(waiter);

        gate.ReleaseSlot(10);

        await waiter.WaitAsync(TimeSpan.FromSeconds(2));
        waiter.IsCompletedSuccessfully.Should().BeTrue();
    }

    [Fact]
    public async Task WaitForSlotAsync_AtByteCeiling_BlocksThenUnblocksOnRelease()
    {
        var gate = NewGate(maxFiles: 5, maxBytes: 10);
        await gate.WaitForSlotAsync(10, CancellationToken.None);

        var waiter = gate.WaitForSlotAsync(1, CancellationToken.None);

        var wonRace = await Task.WhenAny(waiter, Task.Delay(TimeSpan.FromMilliseconds(200)));
        wonRace.Should().NotBe(waiter);

        gate.ReleaseSlot(10);

        await waiter.WaitAsync(TimeSpan.FromSeconds(2));
        waiter.IsCompletedSuccessfully.Should().BeTrue();
    }

    [Fact]
    public async Task WaitForSlotAsync_FileLargerThanMaxStagedBytes_AdmitsWhenStagingAreaEmpty()
    {
        var gate = NewGate(maxFiles: 5, maxBytes: 100);

        var waiter = gate.WaitForSlotAsync(1_000, CancellationToken.None);

        await waiter.WaitAsync(TimeSpan.FromSeconds(2));

        gate.Current.Should().Be((1, 100));
    }

    [Fact]
    public async Task Current_ReturnsToZero_AfterEveryAdmissionIsReleased()
    {
        var gate = NewGate(maxFiles: 5, maxBytes: 100);
        await gate.WaitForSlotAsync(50, CancellationToken.None);
        await gate.WaitForSlotAsync(30, CancellationToken.None);

        gate.Current.Should().Be((2, 80));

        gate.ReleaseSlot(50);
        gate.ReleaseSlot(30);

        gate.Current.Should().Be((0, 0));
    }

    [Fact]
    public async Task Adjust_ActualSmallerThanReserved_FreesTheDifferenceForWaiters()
    {
        var gate = NewGate(maxFiles: 5, maxBytes: 100);
        await gate.WaitForSlotAsync(80, CancellationToken.None);

        var waiter = gate.WaitForSlotAsync(30, CancellationToken.None);
        var wonRace = await Task.WhenAny(waiter, Task.Delay(TimeSpan.FromMilliseconds(200)));
        wonRace.Should().NotBe(waiter);

        var effective = gate.Adjust(reservedBytes: 80, actualBytes: 20);

        effective.Should().Be(20);
        await waiter.WaitAsync(TimeSpan.FromSeconds(2));
        gate.Current.Should().Be((2, 50));
    }

    [Fact]
    public void Adjust_ActualLargerThanReserved_HoldsTheDifference()
    {
        var gate = NewGate(maxFiles: 5, maxBytes: 1000);
        gate.WaitForSlotAsync(10, CancellationToken.None).GetAwaiter().GetResult();

        var effective = gate.Adjust(reservedBytes: 10, actualBytes: 200);

        effective.Should().Be(200);
        gate.Current.Bytes.Should().Be(200);
    }

    [Fact]
    public void Adjust_ActualExceedsMaxStagedBytes_ClampsEffectiveReservation()
    {
        var gate = NewGate(maxFiles: 5, maxBytes: 100);
        gate.WaitForSlotAsync(50, CancellationToken.None).GetAwaiter().GetResult();

        var effective = gate.Adjust(reservedBytes: 50, actualBytes: 500);

        effective.Should().Be(100);
        gate.Current.Bytes.Should().Be(100);
    }

    private static TransferCapacityGate NewGate(int maxFiles, long maxBytes) =>
        new(new TransferOptions { MaxStagedFiles = maxFiles, MaxStagedBytes = maxBytes });
}
