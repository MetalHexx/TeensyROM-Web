using NSubstitute;
using TeensyRom.Cli.Storage.Entities;
using TeensyRom.Cli.Storage.Services;

namespace TeensyRom.Cli.Tests;

public sealed class LaunchHistoryTests
{
    private readonly LaunchHistory _history = new();

    private static ILaunchableItem Item() => Substitute.For<ILaunchableItem>();

    [Fact]
    public void Previous_AfterRemovingTheCurrentEntryAndAddingAnother_StepsBackOneEntryAtATime()
    {
        var (a, b, c, d) = (Item(), Item(), Item(), Item());
        _history.Add(a);
        _history.Add(b);
        _history.Add(c);
        _history.GetPrevious().Should().BeSameAs(b);

        _history.Remove(b);
        _history.GetNext().Should().BeSameAs(c);
        _history.Add(d);

        _history.GetPrevious().Should().BeSameAs(c);
        _history.GetPrevious().Should().BeSameAs(a);
        _history.GetPrevious().Should().BeNull();
    }

    [Fact]
    public void Add_AfterRemovingAnEarlierEntry_DropsTheEntriesAfterTheCurrentOne()
    {
        var (a, b, c, d, e) = (Item(), Item(), Item(), Item(), Item());
        _history.Add(a);
        _history.Add(b);
        _history.Add(c);
        _history.Add(d);
        _history.GetPrevious();
        _history.GetPrevious().Should().BeSameAs(b);

        _history.Remove(a);
        _history.Add(e);

        _history.GetNext().Should().BeNull();
        _history.GetPrevious().Should().BeSameAs(b);
        _history.GetPrevious().Should().BeNull();
    }

    [Fact]
    public void Remove_OfAnEntryNotInTheHistory_ChangesNothing()
    {
        var (a, b) = (Item(), Item());
        _history.Add(a);

        _history.Remove(b);

        _history.CurrentIsNew.Should().BeTrue();
        _history.GetPrevious().Should().BeNull();
    }
}
