using Spectre.Console;
using Spectre.Console.Rendering;
using TeensyRom.Cli.Api;

namespace TeensyRom.Cli.Helpers;

/// <summary>
/// A choice prompt that keeps part of the screen live: a header that is rebuilt on an interval while the user decides.
/// </summary>
internal static class LiveChoicePrompt
{
    private static readonly TimeSpan KeyPoll = TimeSpan.FromMilliseconds(50);

    /// <summary>
    /// Shows <paramref name="refreshHeader"/>'s header, then "? <paramref name="title"/>" and the choices under one live
    /// display, rebuilding the header every <paramref name="refreshInterval"/> while waiting. Up and Down move the cursor
    /// (wrapping), Enter returns the choice under it. A refresh that throws <see cref="TeensyApiException"/> keeps the
    /// last header and adds one error line until a refresh succeeds.
    /// </summary>
    public static async Task<string> ShowAsync(
        IAnsiConsole console,
        string title,
        IReadOnlyList<string> choices,
        Func<CancellationToken, Task<IRenderable>> refreshHeader,
        TimeSpan refreshInterval,
        CancellationToken ct)
    {
        var theme = RadHelper.Theme;
        var state = new Header(Start(refreshHeader, ct));
        var cursor = 0;

        IRenderable Render(string? answer = null)
        {
            var rows = new List<IRenderable> { state.Current, new Markup(string.Empty) };

            if (answer is not null)
            {
                rows.Add(new Markup($"[{theme.Primary}]{Markup.Escape(title)}: [/][{theme.Secondary}]{Markup.Escape(answer)}[/]"));
                return new Rows(rows);
            }
            rows.Add(new Markup($"[{theme.Primary}]? {Markup.Escape(title)}[/]"));
            for (var i = 0; i < choices.Count; i++)
            {
                rows.Add(i == cursor
                    ? new Markup($"[{theme.Secondary}]> {Markup.Escape(choices[i])}[/]")
                    : new Markup($"  {Markup.Escape(choices[i])}"));
            }
            return new Rows(rows);
        }

        await state.SettleAsync();

        var nextRefresh = DateTime.UtcNow + refreshInterval;
        string? chosen = null;

        await console.Live(Render()).AutoClear(false).StartAsync(async live =>
        {
            while (chosen is null)
            {
                ct.ThrowIfCancellationRequested();

                var changed = false;

                while (chosen is null && console.Input.IsKeyAvailable())
                {
                    switch (console.Input.ReadKey(intercept: true)?.Key)
                    {
                        case ConsoleKey.UpArrow:
                            cursor = (cursor - 1 + choices.Count) % choices.Count;
                            changed = true;
                            break;
                        case ConsoleKey.DownArrow:
                            cursor = (cursor + 1) % choices.Count;
                            changed = true;
                            break;
                        case ConsoleKey.Enter:
                            chosen = choices[cursor];
                            break;
                    }
                }
                if (chosen is not null) break;

                if (state.Pending is null && DateTime.UtcNow >= nextRefresh)
                {
                    state.Pending = Start(refreshHeader, ct);
                }
                if (state.Pending is { IsCompleted: true })
                {
                    await state.SettleAsync();
                    nextRefresh = DateTime.UtcNow + refreshInterval;
                    changed = true;
                }
                if (changed)
                {
                    live.UpdateTarget(Render());
                    live.Refresh();
                }
                await Task.Delay(KeyPoll, ct);
            }
            live.UpdateTarget(Render(chosen));
            live.Refresh();
        });

        return chosen!;
    }

    private static Task<IRenderable> Start(Func<CancellationToken, Task<IRenderable>> refreshHeader, CancellationToken ct)
    {
        try
        {
            return refreshHeader(ct);
        }
        catch (Exception ex)
        {
            return Task.FromException<IRenderable>(ex);
        }
    }

    /// <summary>The header as last built, with the refresh in flight and the error that last failed one.</summary>
    private sealed class Header(Task<IRenderable> first)
    {
        private string? _error;
        private IRenderable _built = new Markup(string.Empty);

        public Task<IRenderable>? Pending { get; set; } = first;

        public IRenderable Current => _error is null
            ? _built
            : new Rows(_built, new Markup($"[{RadHelper.Theme.Error}]{Markup.Escape(_error)}[/]"));

        /// <summary>Takes the finished refresh's header, or its error when tr-web couldn't answer.</summary>
        public async Task SettleAsync()
        {
            var pending = Pending;

            Pending = null;
            if (pending is null) return;

            try
            {
                _built = await pending;
                _error = null;
            }
            catch (TeensyApiException ex)
            {
                _error = ex.Message;
            }
        }
    }
}
