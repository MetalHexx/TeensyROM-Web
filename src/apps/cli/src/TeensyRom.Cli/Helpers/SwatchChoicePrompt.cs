using Spectre.Console;
using Spectre.Console.Rendering;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Helpers;

/// <summary>One row of the color menu. Color null is the "Keep current" entry; the record itself is never null.</summary>
internal sealed record ColorChoice(C64Color? Color, string Label);

/// <summary>
/// A menu of the C64's 16 colors that draws each row itself. <see cref="SelectionPrompt{T}"/> strips the markup from its
/// highlighted row, which would drop the cursor row's swatch color, so it can't host swatches.
/// </summary>
internal static class SwatchChoicePrompt
{
    private const string KeepCurrent = "Keep current";

    private static readonly TimeSpan KeyPoll = TimeSpan.FromMilliseconds(50);

    /// <summary>
    /// Shows "? <paramref name="title"/>", then the 16 colors in index order, each a swatch and its name with " (current)"
    /// on <paramref name="current"/>, then "Keep current". The cursor starts on the current color; Up and Down move it
    /// (wrapping) and Enter returns the row under it. The cursor row keeps its swatch's own color and shows its name in the
    /// theme's Secondary color. After Enter the display collapses to "title: name".
    /// </summary>
    public static ColorChoice Show(IAnsiConsole console, string title, C64Color current)
    {
        var theme = RadHelper.Theme;
        var choices = C64Palette.Colors
            .Select(color => new ColorChoice(color, color.Name))
            .Append(new ColorChoice(null, KeepCurrent))
            .ToList();
        var cursor = current.Index;
        ColorChoice? chosen = null;

        IRenderable Render(ColorChoice? answer = null)
        {
            if (answer is not null)
            {
                return new Markup($"[{theme.Primary}]{Markup.Escape(title)}: [/][{theme.Secondary}]{Markup.Escape(answer.Label)}[/]");
            }

            var rows = new List<IRenderable> { new Markup($"[{theme.Primary}]? {Markup.Escape(title)}[/]") };

            for (var i = 0; i < choices.Count; i++)
            {
                var choice = choices[i];
                var swatch = choice.Color is null ? "" : $"[{choice.Color.Hex}]██[/] ";
                var name = Markup.Escape(choice.Label) + (choice.Color == current ? " (current)" : "");

                rows.Add(i == cursor
                    ? new Markup($"[{theme.Secondary}]> [/]{swatch}[{theme.Secondary}]{name}[/]")
                    : new Markup($"  {swatch}{name}"));
            }
            return new Rows(rows);
        }

        console.Live(Render()).AutoClear(false).Start(live =>
        {
            live.Refresh();

            while (chosen is null)
            {
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

                if (changed)
                {
                    live.UpdateTarget(Render());
                    live.Refresh();
                }
                Thread.Sleep(KeyPoll);
            }
            live.UpdateTarget(Render(chosen));
            live.Refresh();
        });

        return chosen!;
    }
}
