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
    public void Items_AreInTheOrderAdded_AndCurrentIndexFollowsTheWalk()
    {
        var (a, b, c) = (Item(), Item(), Item());
        _history.Items.Should().BeEmpty();
        _history.CurrentIndex.Should().Be(-1);

        _history.Add(a);
        _history.Add(b);
        _history.Add(c);
        _history.CurrentIndex.Should().Be(2);

        _history.GetPrevious();
        _history.Items.Should().Equal(a, b, c);
        _history.CurrentIndex.Should().Be(1);
    }

    [Fact]
    public void Clear_EmptiesTheHistory_AndItsIndex()
    {
        _history.Add(Item());
        _history.Add(Item());

        _history.Clear();

        _history.Items.Should().BeEmpty();
        _history.CurrentIndex.Should().Be(-1);
    }

    [Fact]
    public void Restore_ReplacesTheHistory_AndWalksFromTheGivenPosition()
    {
        var (old, a, b, c) = (Item(), Item(), Item(), Item());
        _history.Add(old);

        _history.Restore([a, b, c], 1);

        _history.Items.Should().Equal(a, b, c);
        _history.CurrentIndex.Should().Be(1);
        _history.GetNext().Should().BeSameAs(c);
        _history.GetPrevious().Should().BeSameAs(b);
        _history.GetPrevious().Should().BeSameAs(a);
        _history.GetPrevious().Should().BeNull();
    }

    [Theory]
    [InlineData(9, 2)]
    [InlineData(-5, -1)]
    public void Restore_KeepsThePositionWithinTheEntries(int given, int expected)
    {
        _history.Restore([Item(), Item(), Item()], given);

        _history.CurrentIndex.Should().Be(expected);
    }

    [Fact]
    public void Restore_AfterwardsAddingDropsTheEntriesAfterThePosition_AsAfterAWalkBack()
    {
        var (a, b, c, d) = (Item(), Item(), Item(), Item());
        _history.Restore([a, b, c], 0);

        _history.Add(d);

        _history.Items.Should().Equal(a, d);
        _history.CurrentIndex.Should().Be(1);
        _history.GetNext().Should().BeNull();
    }

    [Fact]
    public void Restore_OfNothing_LeavesAnEmptyHistory()
    {
        _history.Add(Item());

        _history.Restore([], 3);

        _history.Items.Should().BeEmpty();
        _history.CurrentIndex.Should().Be(-1);
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
