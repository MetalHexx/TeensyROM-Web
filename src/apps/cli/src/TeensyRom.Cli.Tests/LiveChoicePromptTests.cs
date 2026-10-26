using Spectre.Console;
using Spectre.Console.Rendering;
using Spectre.Console.Testing;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Helpers;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The choice prompt whose header keeps refreshing, on an interactive test console with the keys queued up front.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class LiveChoicePromptTests
{
    private static readonly string[] Choices = ["First", "Second", "Third"];

    private static readonly TimeSpan Soon = TimeSpan.FromMilliseconds(20);

    private static TestConsole NewConsole()
    {
        var console = new TestConsole();
        console.Profile.Width = 120;
        return console.Interactive();
    }

    private static Task<string> Show(TestConsole console, Func<CancellationToken, Task<IRenderable>> header) =>
        LiveChoicePrompt.ShowAsync(console, "Choose wisely", Choices, header, Soon, CancellationToken.None);

    [Fact]
    public async Task DownDownEnter_ReturnsTheThirdChoice()
    {
        var console = NewConsole();
        console.Input.PushKey(ConsoleKey.DownArrow);
        console.Input.PushKey(ConsoleKey.DownArrow);
        console.Input.PushKey(ConsoleKey.Enter);

        var chosen = await Show(console, _ => Task.FromResult<IRenderable>(new Markup("header")));

        chosen.Should().Be("Third");
        console.Output.Should().Contain("header").And.Contain("Choose wisely");
    }

    [Fact]
    public async Task UpFromTheFirstChoice_WrapsToTheLast()
    {
        var console = NewConsole();
        console.Input.PushKey(ConsoleKey.UpArrow);
        console.Input.PushKey(ConsoleKey.Enter);

        var chosen = await Show(console, _ => Task.FromResult<IRenderable>(new Markup("header")));

        chosen.Should().Be("Third");
    }

    [Fact]
    public async Task TheHeader_IsBuiltAgain_AfterTheRefreshInterval_WhileWaiting()
    {
        var console = NewConsole();
        var calls = 0;

        var chosen = await Show(console, _ =>
        {
            if (++calls == 3) console.Input.PushKey(ConsoleKey.Enter);
            return Task.FromResult<IRenderable>(new Markup($"header {calls}"));
        });

        chosen.Should().Be("First");
        calls.Should().BeGreaterThanOrEqualTo(3);
        console.Output.Should().Contain("header 3");
    }

    [Fact]
    public async Task ARefreshThatThrows_KeepsThePromptAliveAndTheLastHeader_WithOneErrorLine()
    {
        var console = NewConsole();
        var calls = 0;

        var chosen = await Show(console, _ =>
        {
            switch (++calls)
            {
                case 1: return Task.FromResult<IRenderable>(new Markup("last good header"));
                case 2: throw new TeensyApiException("tr-web stopped answering.");
                default:
                    console.Input.PushKey(ConsoleKey.Enter);
                    return Task.FromResult<IRenderable>(new Markup("recovered"));
            }
        });

        chosen.Should().Be("First");
        console.Output.Should().Contain("last good header").And.Contain("tr-web stopped answering.").And.Contain("recovered");
    }
}
