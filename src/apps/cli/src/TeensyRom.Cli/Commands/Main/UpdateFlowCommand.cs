using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Update;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Commands.Main
{
    internal class UpdateFlowSettings : CommandSettings
    {
    }

    /// <summary>
    /// The menu's "Update to …": looks up the newest release, asks, and installs it. Returns 0 only when it updated, which
    /// is when the menu closes, because this process is still the old version. Failures are thrown for the menu to show.
    /// </summary>
    internal class UpdateFlowCommand(IUpdateRunner updates, ICliOutput output) : AsyncCommand<UpdateFlowSettings>
    {
        public override async Task<int> ExecuteAsync(CommandContext context, UpdateFlowSettings settings)
        {
            RadHelper.WriteMenu("Update", "Install the newest TeensyROM Suite release.");

            var check = await UpdateWork.CheckAsync(output, updates);
            var status = check.Status;

            if (!status.Available)
            {
                RadHelper.WriteLine(UpdateWork.Describe(status));
                return 1;
            }

            if (!PromptHelper.Confirm($"Update TeensyROM Suite from {status.Installed} to {status.Latest}? Trom API stops and starts again if it is running.", defaultValue: true))
            {
                RadHelper.WriteLine("Cancelled; nothing was changed.");
                return 1;
            }

            var applied = await UpdateWork.ApplyAsync(output, updates, check);

            RadHelper.WriteSuccess(UpdateWork.Result(applied));
            if (UpdateWork.RestartNotice(applied) is { } notice) output.Notice(notice);
            RadHelper.WriteLine($"Closing the menu — run `trom` again to use TeensyROM Suite {applied.To}.");

            return 0;
        }
    }
}
