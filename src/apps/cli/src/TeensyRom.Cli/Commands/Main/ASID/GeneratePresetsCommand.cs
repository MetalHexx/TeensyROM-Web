using System.ComponentModel;
using System.Xml.Linq;
using Newtonsoft.Json;
using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Commands.Main.Asid
{
    internal class GeneratePresetsSettings : TromSettings, IClearableSettings
    {
        [JsonIgnore]
        [Description("SID Clock that matches your machine: PAL or NTSC.")]
        [CommandOption("--clock <CLOCK>")]
        public string Clock { get; set; } = string.Empty;

        [JsonIgnore]
        [Description("Source path of the Chipsynth C64 presets. (Absolute Path)")]
        [CommandOption("--source <SOURCE>")]
        public string SourcePath { get; set; } = string.Empty;

        [JsonIgnore]
        [Description("Target path of the Chipsynth C64 presets. (Relative Path)")]
        [CommandOption("--target <TARGET>")]
        public string TargetPath { get; set; } = string.Empty;
        public bool RunWizard { get; set; } = false;

        public static string Description => "Generate ASID friendly Chipsynth ASID presets.";
        public static string Example => "chipsynth --clock ntsc --target ASID --source c:\\your\\preset\\directory";

        public override ValidationResult Validate()
        {
            var validSource = string.IsNullOrWhiteSpace(SourcePath) || Directory.Exists(SourcePath);

            if (!validSource)
            {
                return ValidationResult.Error($"The source path '{SourcePath}' does not exist.");
            }
            var validTarget = string.IsNullOrWhiteSpace(TargetPath) || !Path.IsPathRooted(TargetPath);

            if (!validTarget)
            {
                return ValidationResult.Error($"The target path '{TargetPath}' must be a relative path.");
            }
            var validClock = string.IsNullOrWhiteSpace(Clock) || Clock.Equals("PAL", StringComparison.OrdinalIgnoreCase) || Clock.Equals("NTSC", StringComparison.OrdinalIgnoreCase);

            if (!validClock)
            {
                return ValidationResult.Error($"The clock '{Clock}' must be 'PAL' or 'NTSC'.");
            }
            return base.Validate();
        }

        public void ClearSettings()
        {
            Clock = string.Empty;
            SourcePath = string.Empty;
            TargetPath = string.Empty;
            RunWizard = true;
        }
    }

    /// <summary>The result of a one-shot run: what was generated and where.</summary>
    internal sealed record GeneratePresetsResult(string Clock, string Source, string Target, int PresetsWritten, string OutputFolder);

    /// <summary>
    /// Generates the ASID presets. One-shot it runs from its options alone; in the menu it runs the guided wizard.
    /// </summary>
    internal class GeneratePresetsCommand(ICliOutput output, IPlayerService player) : TromCommand<GeneratePresetsSettings>(output)
    {
        protected override Task<int> RunAsync(CommandContext context, GeneratePresetsSettings s, CancellationToken ct)
        {
            player.StopStream();

            var exitCode = Output.RunMode == CliRunMode.OneShot ? GenerateOneShot(s) : GenerateInMenu(s);

            return Task.FromResult(exitCode);
        }

        private int GenerateInMenu(GeneratePresetsSettings s)
        {
            RadHelper.WriteTitle("Chipsynth ASID Preset Generator");
            AnsiConsole.WriteLine();

            var proceed = RunWizard(s);

            if (!proceed)
            {
                RadHelper.WriteTitle("Preset Generation Cancelled");
                return 0;
            }
            RadHelper.WriteTitle("Preset Generation Starting");

            TransformPresets(s);

            RadHelper.WriteTitle("Preset Generation Completed");
            AnsiConsole.WriteLine();

            return 0;
        }

        private int GenerateOneShot(GeneratePresetsSettings s)
        {
            CompleteOptions(s);

            var validation = s.Validate();

            if (!validation.Successful)
            {
                throw new CliException(CliExitCode.Usage, validation.Message ?? "The preset options are invalid.");
            }
            var outputFolder = Path.Combine(s.SourcePath, s.TargetPath);

            if (!EnsureTargetPath(s))
            {
                throw new CliException(CliExitCode.Failed, $"The target folder '{outputFolder}' couldn't be created.");
            }
            var files = GetExistingPresets(s);

            if (files.Count == 0)
            {
                throw new CliException(CliExitCode.Failed, $"No .fermatax files found in '{s.SourcePath}'.");
            }
            foreach (var file in files)
            {
                WritePreset(file, s);
            }
            var result = new GeneratePresetsResult(s.Clock.ToUpper(), s.SourcePath, s.TargetPath, files.Count, outputFolder);

            if (Output.Mode == OutputMode.Json) Output.Json(result);
            else Output.Lines([$"Generated {files.Count} presets in {outputFolder}."]);

            return 0;
        }

        /// <summary>
        /// Fills each option the command line left out. A script can't be asked, so a missing option is a usage error
        /// unless the terminal can answer the prompt.
        /// </summary>
        private void CompleteOptions(GeneratePresetsSettings s)
        {
            if (string.IsNullOrWhiteSpace(s.Clock))
            {
                RequireInteractive("--clock");
                s.Clock = PromptHelper.ChoicePrompt("SID Clock", ["PAL", "NTSC"]);
            }
            if (string.IsNullOrWhiteSpace(s.SourcePath))
            {
                RequireInteractive("--source");
                s.SourcePath = PromptHelper.DefaultValueTextPrompt("Source Path", 4, Directory.GetCurrentDirectory());
            }
            if (string.IsNullOrWhiteSpace(s.TargetPath))
            {
                RequireInteractive("--target");
                s.TargetPath = PromptHelper.DefaultValueTextPrompt("Target Path", 1, "ASID");
            }
        }

        private void RequireInteractive(string option)
        {
            if (!Output.CanPrompt) throw new CliException(CliExitCode.Usage, $"Missing {option}, which is required when no terminal can answer a prompt.");
        }

        public bool RunWizard(GeneratePresetsSettings s)
        {
            var reRun = false;
            do
            {
                if (string.IsNullOrWhiteSpace(s.Clock))
                {
                    s.Clock = PromptHelper.ChoicePrompt("SID Clock", ["PAL", "NTSC"]);
                }
                if (string.IsNullOrEmpty(s.SourcePath))
                {
                    s.SourcePath = PromptHelper.DefaultValueTextPrompt("Source Path", 4, Directory.GetCurrentDirectory());
                }
                if (string.IsNullOrEmpty(s.TargetPath))
                {
                    s.TargetPath = PromptHelper.DefaultValueTextPrompt("Target Path", 1, "ASID");
                }
                OutputSettings(s);

                var proceed = PromptHelper.Confirm("Proceed with preset generation?", true);
                AnsiConsole.WriteLine();

                if (!proceed) return false;

                var validationResult = s.Validate();

                if (validationResult.Message is not null)
                {
                    RadHelper.WriteError(validationResult.Message);
                    AnsiConsole.WriteLine();
                }
                reRun = !s.Validate().Successful || !EnsureTargetPath(s);

                if (reRun)
                {
                    s.SourcePath = string.Empty;
                    s.TargetPath = string.Empty;
                    reRun = true;
                }
            }
            while (reRun);

            return true;
        }

        private static bool EnsureTargetPath(GeneratePresetsSettings s)
        {
            var targetFullPath = Path.Combine(s.SourcePath, s.TargetPath);

            if (!Directory.Exists(targetFullPath))
            {
                try
                {
                    Directory.CreateDirectory(targetFullPath);
                }
                catch (Exception)
                {
                    AnsiConsole.WriteLine();
                    RadHelper.WriteError("Unable to create target path.");
                    AnsiConsole.WriteLine();
                    return false;
                }
            }
            return Directory.Exists(targetFullPath);
        }

        private static void OutputSettings(GeneratePresetsSettings s)
        {
            AnsiConsole.WriteLine();

            var table = new Table()
                .AddColumn("Setting")
                .AddColumn("Value")
                .AddRow(
                    $"SID Clock".AddSecondaryColor(),
                    s.Clock.ToUpper().AddSecondaryColor())
                .AddRow(
                    $"Source Path".AddSecondaryColor(),
                    s.SourcePath.AddSecondaryColor())
                .AddRow(
                    $"Target Path".AddSecondaryColor(),
                    Path.Combine(s.SourcePath, s.TargetPath).AddSecondaryColor())
                .BorderColor(RadHelper.Theme.Primary.Color)
                .Border(TableBorder.Rounded);

            AnsiConsole.Write(table);
            AnsiConsole.WriteLine();
        }

        private int TransformPresets(GeneratePresetsSettings s)
        {
            AnsiConsole.WriteLine();
            List<FileInfo> files = GetExistingPresets(s);

            if (files.Count == 0)
            {
                RadHelper.WriteError("No .fermatax files found.");
                return -1;
            }
            foreach (var file in files)
            {
                WritePreset(file, s);
            }
            AnsiConsole.WriteLine();
            return 0;
        }

        private static List<FileInfo> GetExistingPresets(GeneratePresetsSettings s)
        {
            List<FileInfo> files = [];

            var sourceDirectory = new DirectoryInfo(s.SourcePath);

            files.AddRange(sourceDirectory.GetFiles("*.fermatax", SearchOption.AllDirectories));

            return files;
        }

        private void WritePreset(FileInfo file, GeneratePresetsSettings s)
        {
            var transformer = new PresetTransformer();

            if (file is null)
            {
                RadHelper.WriteError("File was null.");
                return;
            }
            XDocument xmlDoc = XDocument.Load(file.FullName);

            xmlDoc = transformer.Transform(xmlDoc, s.Clock);

            if (file.DirectoryName is null)
            {
                RadHelper.WriteError("File Directory was null.");
                return;
            }
            var newBasePath = Path.Combine(s.SourcePath, s.TargetPath);
            var newDirectoryPath = file.DirectoryName.Replace(s.SourcePath, newBasePath);

            if (!Directory.Exists(newDirectoryPath))
            {
                Directory.CreateDirectory(newDirectoryPath);
            }
            var newFilePath = Path.Combine(newDirectoryPath, file.Name);

            RadHelper.WriteLine($"Writing {newFilePath}");
            xmlDoc.Save(newFilePath);
        }
    }
}
