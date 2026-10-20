using Spectre.Console;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Services
{
    /// <summary>
    /// Shows the messages services publish: on stderr for a one-shot command, on the menu's screen for the menu and
    /// the player, which also blank the line the alert may have drawn over.
    /// </summary>
    internal class CliAlertService(ICliOutput output) : IAlertService
    {
        public IObservable<string> CommandErrors => throw new NotImplementedException();

        public void Publish(string error)
        {
            if(!string.IsNullOrWhiteSpace(error))
            {
                output.Notice(error);
            }
            ClearLine();
        }

        public void PublishError(string message)
        {
            if (output.RunMode == CliRunMode.Tui) RadHelper.WriteError(message.EscapeBrackets());
            else output.Notice(message);

            ClearLine();
        }

        private void ClearLine()
        {
            if (output.RunMode == CliRunMode.Tui) AnsiConsole.WriteLine(RadHelper.ClearHack);
        }
    }
}
