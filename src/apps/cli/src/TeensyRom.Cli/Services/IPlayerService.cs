using TeensyRom.Cli.Commands.Main.Launcher;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Services
{
    /// <summary>
    /// What is playing on the selected device and what plays next. The state starts from the device's last launch record,
    /// so it carries across <c>trom</c> runs.
    /// </summary>
    /// <remarks>
    /// Two faces share one implementation. The menu's members (<see cref="PlayNext"/>, <see cref="TogglePlay"/> and the
    /// like) publish alerts, drive the play timer and turn a tr-web failure into an alert plus a stopped stream. The
    /// <c>*Async</c> members are for one-shot commands: they return what happened, leave the timer alone, and let a
    /// <see cref="Api.TeensyApiException"/> through.
    /// </remarks>
    internal interface IPlayerService
    {
        IObservable<ILaunchableItem> FileLaunched { get; }

        PlayerState GetState();
        Task<bool> LaunchItem(ILaunchableItem item);
        Task LaunchFromDirectory(string path);
        Task PlayNext();
        Task PlayPrevious();

        /// <summary>Picks and launches a random file within the pinned directory and everything below it; null when a tr-web failure was published instead.</summary>
        Task<LaunchOutcome?> PlayRandom();
        void SetFilter(TeensyFilterType filterType);
        void SetStreamTime(TimeSpan? timespan);
        void SetSidTimer(SidTimer value);
        void StopStream();
        void SetDirectoryScope(string path);
        void SetSearchMode(string query);
        void SetDirectoryMode(string path);
        void SetRandomMode(string path);
        Task TogglePlay();
        /// <summary>Saves the storage as the CLI's default-storage preference. For the menu; a command line uses <see cref="UseStorage"/>.</summary>
        void SetStorage(TeensyStorageType storageType);
        /// <summary>Plays from another storage for this session only; the saved default-storage preference is left alone.</summary>
        void UseStorage(TeensyStorageType storageType);

        /// <summary>
        /// Launches what follows the current file: the next file of its folder or search results, the next random pick in
        /// the history or a new one. Files the unit can't run are skipped, until one launches or none is left to try. Null
        /// when there is nothing to carry on from.
        /// </summary>
        /// <returns>The outcome of the launch it ended on: <see cref="LaunchStatus.Incompatible"/> when every file it tried was skipped.</returns>
        /// <exception cref="Api.TeensyApiException">tr-web didn't answer.</exception>
        Task<LaunchOutcome?> NextAsync();

        /// <summary>As <see cref="NextAsync"/>, for the file before the current one; after random picks it walks back through them.</summary>
        Task<LaunchOutcome?> PreviousAsync();

        /// <summary>
        /// Launches one file in directory mode on its folder, with every file type allowed. A file the unit can't run is
        /// reported, not skipped.
        /// </summary>
        /// <exception cref="Api.TeensyApiException">tr-web didn't answer.</exception>
        Task<LaunchOutcome> LaunchOnceAsync(ILaunchableItem item);

        /// <summary>
        /// Records a launch tr-web made on its own, such as an upload's: the player ends as <see cref="LaunchOnceAsync"/> leaves
        /// it, without sending a launch. <see cref="LaunchStatus.Launched"/> is playing and announced; anything else stops.
        /// </summary>
        void RecordLaunched(ILaunchableItem item, LaunchStatus status);

        /// <summary>
        /// Has tr-web pick and launch a random file in random mode and adds a launched pick to the history. A file the
        /// unit can't run is reported, not skipped. When there are no files to pick from, the player and its record stay as
        /// they were.
        /// </summary>
        /// <exception cref="Api.TeensyApiException">tr-web didn't answer.</exception>
        Task<LaunchOutcome> RandomOnceAsync(StorageScope scope, string startingDirectory, TeensyFilterType filter);

        /// <summary>
        /// Plays or pauses: pauses or resumes a song, stops a game by resetting the device, launches again what was stopped.
        /// With nothing to go on it sends a bare music toggle and leaves the state alone.
        /// </summary>
        /// <exception cref="Api.TeensyApiException">tr-web didn't answer, or refused for a reason other than the unit refusing to pause.</exception>
        Task<PlayToggleResult> ToggleAsync();

        /// <summary>Resets the device, which stops whatever it is running, and records the stop.</summary>
        /// <returns>What was current, if anything.</returns>
        /// <exception cref="Api.TeensyApiException">tr-web didn't answer or couldn't reset the device.</exception>
        Task<ILaunchableItem?> StopAsync();
    }

    /// <summary>What <see cref="IPlayerService.ToggleAsync"/> did to the device.</summary>
    internal enum PlayToggleAction
    {
        Paused,
        Resumed,
        Stopped,
        Relaunched,
        /// <summary>A bare music toggle with nothing known about the device, so the result is unknown.</summary>
        Toggled
    }

    /// <summary>
    /// The result of a play/pause. <paramref name="Item"/> is the file it acted on; <paramref name="Reason"/> says why it
    /// stopped or couldn't relaunch rather than do what was asked; <paramref name="Relaunch"/> is the launch's outcome
    /// when <see cref="PlayToggleAction.Relaunched"/>.
    /// </summary>
    internal sealed record PlayToggleResult(PlayToggleAction Action, ILaunchableItem? Item, string? Reason, LaunchOutcome? Relaunch);
}
