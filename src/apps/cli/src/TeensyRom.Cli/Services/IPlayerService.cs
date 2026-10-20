using TeensyRom.Cli.Commands.Main.Launcher;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Services
{
    internal interface IPlayerService
    {
        IObservable<ILaunchableItem> FileLaunched { get; }

        PlayerState GetState();
        Task<bool> LaunchItem(ILaunchableItem item);
        Task LaunchFromDirectory(string path);
        Task PlayNext();
        Task PlayPrevious();
        Task PlayRandom();
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
    }
}
