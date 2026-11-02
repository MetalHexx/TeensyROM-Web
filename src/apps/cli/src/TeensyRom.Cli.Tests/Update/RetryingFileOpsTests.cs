using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

public sealed class RetryingFileOpsTests
{
    private static readonly TimeSpan[] Backoff = [TimeSpan.FromMilliseconds(1), TimeSpan.FromMilliseconds(2), TimeSpan.FromMilliseconds(3)];

    /// <summary>Fails the first <paramref name="failures"/> moves with <paramref name="failure"/>, then moves.</summary>
    private sealed class FlakyMoves(int failures, Exception failure) : DecoratedFileOps(new PhysicalFileOps())
    {
        public int Attempts { get; private set; }

        public override void Move(string source, string destination)
        {
            if (++Attempts <= failures) throw failure;
        }
    }

    [Theory]
    [InlineData(typeof(IOException))]
    [InlineData(typeof(UnauthorizedAccessException))]
    public void Move_RetriesWhatAnotherProcessMayHoldAndSucceedsOnceItLetsGo(Type failure)
    {
        var sleeps = new List<TimeSpan>();
        var inner = new FlakyMoves(2, (Exception)Activator.CreateInstance(failure)!);

        new RetryingFileOps(inner, Backoff, sleeps.Add).Move("a", "b");

        inner.Attempts.Should().Be(3);
        sleeps.Should().Equal(Backoff[0], Backoff[1]);
    }

    [Fact]
    public void Move_GivesUpWhenTheBackoffIsUsedUp_AndThrowsTheLastFailure()
    {
        var sleeps = new List<TimeSpan>();
        var inner = new FlakyMoves(int.MaxValue, new IOException("held"));

        var move = () => new RetryingFileOps(inner, Backoff, sleeps.Add).Move("a", "b");

        move.Should().Throw<IOException>().WithMessage("held");
        inner.Attempts.Should().Be(Backoff.Length + 1);
        sleeps.Should().Equal(Backoff);
    }

    [Theory]
    [InlineData(typeof(FileNotFoundException))]
    [InlineData(typeof(DirectoryNotFoundException))]
    [InlineData(typeof(InvalidOperationException))]
    public void Move_DoesNotRetryAFailureWaitingCantFix(Type failure)
    {
        var sleeps = new List<TimeSpan>();
        var inner = new FlakyMoves(int.MaxValue, (Exception)Activator.CreateInstance(failure)!);

        var move = () => new RetryingFileOps(inner, Backoff, sleeps.Add).Move("a", "b");

        move.Should().Throw<Exception>();
        inner.Attempts.Should().Be(1);
        sleeps.Should().BeEmpty();
    }

    [Fact]
    public void ByDefault_ItWaitsAboutFifteenSecondsInAll()
    {
        RetryingFileOps.DefaultBackoff.Aggregate(TimeSpan.Zero, (total, wait) => total + wait)
            .Should().BeGreaterThan(TimeSpan.FromSeconds(13)).And.BeLessThan(TimeSpan.FromSeconds(17));
    }
}
