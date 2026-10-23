using System.Reactive.Linq;
using System.Reactive.Subjects;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Progress;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;
using TeensyRom.Cli.Storage.Services;

namespace TeensyRom.Cli.Services
{
    /// <summary>
    /// Sequences what plays next, previous or at random, and keeps the play timer. Its state starts from the selected
    /// device's last launch record and every operation that touches the device writes the record again.
    /// </summary>
    /// <remarks>
    /// The <c>*Async</c> members are the sequencing, for one-shot commands: they return outcomes, never touch the play
    /// timer and let a tr-web failure through. The menu's members wrap them: failures never escape, they are published as
    /// alerts and the stream stops, and the play timer follows what was launched, paused or resumed.
    /// </remarks>
    internal class PlayerService : IPlayerService
    {
        private const string NotPausableReason = "games and programs can't be paused, so it was stopped by resetting the device";
        private const string RefusedPauseReason = "the TeensyROM refused to pause — something that can't be paused, like a game, is probably running — so it was stopped by resetting the device";
        private const int BadGateway = 502;

        public IObservable<ILaunchableItem> FileLaunched => _fileLaunched.AsObservable();
        private Subject<ILaunchableItem> _fileLaunched = new();
        private PlayerState _state;
        private string? _restoredDeviceId;
        private bool _timerStarted;

        private IDisposable? _timerSubscription;
        private readonly IStorageService _storage;
        private readonly ILaunchService _launch;
        private readonly IDeviceService _devices;
        private readonly IProgressTimer _timer;
        private readonly ISettingsService _settingsService;
        private readonly ILaunchHistory _randomHistory;
        private readonly IAlertService _alert;
        private readonly ILoggingService _log;
        private readonly ILastLaunchStore _store;

        public PlayerService(IStorageService storage, ILaunchService launch, IDeviceService devices, IProgressTimer progressTimer, ISettingsService settingsService, ILaunchHistory history, IAlertService alert, ILoggingService log, ILastLaunchStore store)
        {
            _storage = storage;
            _launch = launch;
            _devices = devices;
            _timer = progressTimer;
            _settingsService = settingsService;
            _randomHistory = history;
            _alert = alert;
            _log = log;
            _store = store;
            var settings = settingsService.GetSettings();

            _state = new()
            {
                StorageType = settings.StorageType,
                FilterType = settings.StartupFilter,
            };

            SetupTimerSubscription();
        }

        /// <summary>
        /// Takes the selected device's last launch record as the state the first time that device is seen. Runs first in
        /// every public member, so a setter or a launch always builds on the restored state instead of being overwritten by it.
        /// </summary>
        /// <remarks>
        /// The storage is applied to the state only: the menu browses through <see cref="IStorageService"/> with the user's
        /// saved storage before it calls <see cref="SetStorage"/>, and the sequencing aligns it when it needs it. A restored
        /// stream can't auto-advance until a launch in this process starts a timer.
        /// </remarks>
        private void EnsureRestored()
        {
            if (_devices.SelectedDevice?.Id is not { } deviceId || deviceId == _restoredDeviceId) return;

            _restoredDeviceId = deviceId;

            if (_store.Load(deviceId) is not { } record) return;

            _state = _state with
            {
                StorageType = record.Storage,
                CurrentItem = ToItem(record.Current),
                PlayMode = record.Mode,
                SearchQuery = record.SearchQuery,
                FilterType = record.Filter,
                Scope = record.Scope,
                ScopePath = record.ScopePath,
                PlayState = record.PlayState
            };
            _randomHistory.Restore(record.RandomPicks.Select(ToItem).OfType<ILaunchableItem>(), record.RandomIndex);

            _timerSubscription?.Dispose();
            _timerSubscription = null;
            _timerStarted = false;
        }

        /// <summary>Writes the selected device's record from the state. Only for operations that touch the device, so the record follows what it is doing.</summary>
        private void Persist()
        {
            if (_devices.SelectedDevice is not { } device) return;

            _store.Save(new LastLaunchRecord(
                device.Id,
                device.Name,
                _state.StorageType,
                _state.CurrentItem is { } current ? new LaunchedFile(current.Path, current.Size) : null,
                _state.PlayMode,
                _state.SearchQuery,
                _state.FilterType,
                _state.Scope,
                _state.ScopePath,
                _state.PlayState,
                _randomHistory.Items.Select(pick => new LaunchedFile(pick.Path, pick.Size)).ToList(),
                _randomHistory.CurrentIndex));
        }

        /// <summary>Rebuilds a file from its record. The size is what makes its id match the ones directory listings give.</summary>
        private static ILaunchableItem? ToItem(LaunchedFile? file)
        {
            if (file is null) return null;

            var item = FileItem.Create(file.Path) as ILaunchableItem;

            if (item is not null) item.Size = file.Size;

            return item;
        }

        public Task LaunchFromDirectory(string path) => Guarded(async () =>
        {
            EnsureRestored();

            var directory = await _storage.GetDirectory(path.GetUnixParentPath());
            var fileItem = directory.Files.FirstOrDefault(f => f.Path.Contains(path));

            if (fileItem is not ILaunchableItem launchItem)
            {
                _alert.PublishError("File is not launchable.");
                return;
            }
            var outcome = await Launch(launchItem);

            if (outcome.Status is LaunchStatus.Incompatible)
            {
                outcome = await NextCore() ?? outcome;
            }
            Conclude(outcome);
        });

        public Task<bool> LaunchItem(ILaunchableItem item) => Guarded(async () =>
        {
            EnsureRestored();

            var outcome = await Launch(item);

            Conclude(outcome);
            return outcome.Status is LaunchStatus.Launched;
        });

        /// <summary>
        /// One launch attempt, recorded. An <see cref="LaunchStatus.Incompatible"/> outcome means the file was skipped: it is
        /// marked, and moving on to another file is up to the caller.
        /// </summary>
        private async Task<LaunchOutcome> Launch(ILaunchableItem item)
        {
            _state = _state with
            {
                CurrentItem = item,
                PlayState = PlayState.Playing
            };
            if (!item.IsCompatible)
            {
                AlertBadFile(item);
                Persist();
                return new LaunchOutcome(LaunchStatus.Incompatible, item, null);
            }
            var outcome = await _launch.LaunchFile(_state.StorageType, item);

            outcome = outcome.Status switch
            {
                LaunchStatus.Launched => OnLaunched(item, outcome),
                LaunchStatus.Incompatible => SkipIncompatible(item, outcome),
                _ => Refused(outcome, $"Failed to launch {item.Name}.")
            };
            Persist();
            return outcome;
        }

        /// <summary>The engine's record of the file, when it sent one, becomes the current item and is what <see cref="FileLaunched"/> publishes.</summary>
        private LaunchOutcome OnLaunched(ILaunchableItem item, LaunchOutcome outcome)
        {
            var launched = outcome.Item ?? item;

            _state = _state with { CurrentItem = launched };
            Announce(launched);

            return outcome with { Item = launched };
        }

        private void Announce(ILaunchableItem item)
        {
            _fileLaunched.OnNext(item);
            _alert.Publish(RadHelper.ClearHack);
        }

        private LaunchOutcome SkipIncompatible(ILaunchableItem item, LaunchOutcome outcome)
        {
            item.IsCompatible = false;
            _randomHistory.Remove(item);
            AlertBadFile(item);
            return outcome;
        }

        /// <summary>
        /// tr-web said it can't launch the file. Moving on to another file would only repeat the request, so the player stops here.
        /// </summary>
        /// <param name="fallback">What to say when tr-web didn't say why; null leaves the outcome as it is.</param>
        private LaunchOutcome Refused(LaunchOutcome outcome, string? fallback)
        {
            _state = _state with { PlayState = PlayState.Stopped };

            return fallback is not null && string.IsNullOrWhiteSpace(outcome.Message)
                ? outcome with { Message = fallback }
                : outcome;
        }

        private void AlertBadFile(ILaunchableItem item)
        {
            _alert.Publish(RadHelper.ClearHack);
            _alert.PublishError($"{item.Name} is currently unsupported (see logs).  Skipping file.");
        }

        /// <summary>The menu's end of a launch: starts the stream of what launched, or publishes why nothing did.</summary>
        private void Conclude(LaunchOutcome? outcome)
        {
            switch (outcome)
            {
                case { Status: LaunchStatus.Launched, Item: { } item }:
                    MaybeStartStream(item);
                    break;

                case { Status: LaunchStatus.NotFound, Message: LaunchOutcome.NoFilesFoundMessage }:
                    _alert.PublishError($"No files for the filter \"{_state.FilterType}\" were found on the {_state.StorageType} in {_state.ScopePath}.");
                    break;

                case { Status: LaunchStatus.NotFound or LaunchStatus.Failed, Message: { } message }:
                    _alert.PublishError(message);
                    break;
            }
        }

        private async Task Guarded(Func<Task> operation)
        {
            try
            {
                await operation();
            }
            catch (TeensyApiException ex)
            {
                _alert.PublishError(ex.Message);
                StopStream();
            }
        }

        private async Task<T?> Guarded<T>(Func<Task<T>> operation)
        {
            try
            {
                return await operation();
            }
            catch (TeensyApiException ex)
            {
                _alert.PublishError(ex.Message);
                StopStream();
                return default;
            }
        }

        public Task<LaunchOutcome?> PlayRandom() => Guarded(async () =>
        {
            EnsureRestored();
            _state = _state with { Scope = StorageScope.DirDeep };

            var outcome = await PickRandom(menu: true);

            Conclude(outcome);
            return outcome;
        });

        /// <summary>
        /// Has tr-web pick a random file and launches it, in random mode. In the menu a pick the unit can't run is skipped
        /// for the next file; otherwise it is the outcome.
        /// </summary>
        private async Task<LaunchOutcome> PickRandom(bool menu)
        {
            if (_state.PlayMode is not PlayMode.Random)
            {
                _randomHistory.Clear();
            }
            _state.PlayMode = PlayMode.Random;

            var outcome = await _launch.LaunchRandom(_state.StorageType, _state.Scope, _state.ScopePath, _state.FilterType);

            switch (outcome)
            {
                case { Status: LaunchStatus.Launched, Item: { } randomItem }:
                    _state = _state with { CurrentItem = randomItem, PlayState = PlayState.Playing };
                    Announce(randomItem);
                    _randomHistory.Add(randomItem);
                    break;

                case { Status: LaunchStatus.Incompatible, Item: { } badItem } when menu:
                    _state = _state with { CurrentItem = badItem, PlayState = PlayState.Playing };
                    SkipIncompatible(badItem, outcome);
                    Persist();
                    return await NextCore() ?? outcome;

                case { Status: LaunchStatus.Incompatible, Item: { } badItem }:
                    _state = _state with { CurrentItem = badItem, PlayState = PlayState.Stopped };
                    break;

                case { Status: LaunchStatus.NotFound, Message: LaunchOutcome.NoFilesFoundMessage }:
                    break;

                default:
                    outcome = Refused(outcome, menu ? "Failed to launch a random file." : null);
                    break;
            }
            Persist();
            return outcome;
        }

        public Task PlayPrevious() => Guarded(async () => Conclude(await PreviousAsync()));

        public async Task<LaunchOutcome?> PreviousAsync()
        {
            EnsureRestored();
            _storage.UseStorage(_state.StorageType);

            return await PreviousCore();
        }

        private async Task<LaunchOutcome?> PreviousCore()
        {
            ILaunchableItem? fileToPlay = _state.PlayMode switch
            {
                PlayMode.Random => _randomHistory.GetPrevious(GetFilterFileTypes()),
                PlayMode.Search => await GetPreviousSearchItem(),
                PlayMode.CurrentDirectory => await GetPreviousDirectoryItem(),
                _ => _state.CurrentItem
            };
            if(fileToPlay is null)
            {
                if (_state.CurrentItem is null)
                {
                    return null;
                }
                fileToPlay = _state.CurrentItem;
            }
            var outcome = await Launch(fileToPlay);

            return outcome.Status is LaunchStatus.Incompatible
                ? await PreviousCore() ?? outcome
                : outcome;
        }

        private async Task<ILaunchableItem?> GetPreviousSearchItem()
        {
            var list = (await _storage.Search(_state.SearchQuery!, TeensyFilterType.All)).ToList();
            return GetPreviousFromList(list);
        }

        private async Task<ILaunchableItem?> GetPreviousDirectoryItem()
        {
            if (_state.CurrentItem is null) return null;

            var currentPath = _state.CurrentItem.Path.GetUnixParentPath();
            var currentDirectory = await _storage.GetDirectory(currentPath);
            var files = currentDirectory.Files.OfType<ILaunchableItem>().ToList();
            return GetPreviousFromList(files);
        }

        private ILaunchableItem? GetPreviousFromList(List<ILaunchableItem> list)
        {
            var unfilteredFiles = list;

            if (unfilteredFiles.Count == 0)
            {
                _alert.PublishError("Something went wrong.  I couldn't find any files in the target location.");
                return null;
            }
            var currentFile = unfilteredFiles.ToList().FirstOrDefault(f => f.Id == _state.CurrentItem?.Id);

            if (currentFile is null)
            {
                _alert.PublishError("Something went wrong.  I couldn't find the current file in the target location.");
                return null;
            }

            var filteredFiles = unfilteredFiles
                .Where(f => GetFilterFileTypes()
                    .Any(t => f.FileType == t))
                .ToList();

            if (filteredFiles.Count() == 0)
            {
                _alert.PublishError("There were no files matching your filter in the target location");
                return null;
            }

            var currentFileUnfilteredIndex = unfilteredFiles.IndexOf(currentFile);

            var currentFileComesAfterLastItemInFilteredList = unfilteredFiles.IndexOf(filteredFiles.Last()) < currentFileUnfilteredIndex;

            if (currentFileComesAfterLastItemInFilteredList)
            {
                return filteredFiles.Last();
            }
            var filteredIndex = filteredFiles.IndexOf(currentFile);

            if (filteredIndex != -1)
            {
                var index = filteredIndex == 0
                    ? filteredFiles.Count - 1
                    : filteredIndex - 1;

                return filteredFiles[index];
            }

            ILaunchableItem? candidate = null;

            for (int x = 0; x < filteredFiles.Count; x++)
            {
                var f = filteredFiles[x];

                var fIndex = unfilteredFiles.IndexOf(f);

                if (fIndex < currentFileUnfilteredIndex)
                {
                    candidate = f;
                    continue;
                }
                else if (fIndex > currentFileUnfilteredIndex)
                {
                    break;
                }
            }
            if (candidate is null)
            {
                return filteredFiles.First();
            }
            return candidate;
        }

        public Task PlayNext() => Guarded(async () => Conclude(await NextAsync()));

        public async Task<LaunchOutcome?> NextAsync()
        {
            EnsureRestored();
            _storage.UseStorage(_state.StorageType);

            return await NextCore();
        }

        private async Task<LaunchOutcome?> NextCore()
        {
            ILaunchableItem? fileToPlay = null;

            switch (_state.PlayMode)
            {
                case PlayMode.Random:
                    fileToPlay = _randomHistory.GetNext(GetFilterFileTypes());

                    if (fileToPlay is null)
                    {
                        return await PickRandom(menu: true);
                    }
                    break;

                case PlayMode.Search:
                    fileToPlay = await GetNextSearchItem();
                    break;

                case PlayMode.CurrentDirectory:
                    fileToPlay = await GetNextDirectoryItem();
                    break;
            }

            if (fileToPlay is null)
            {
                fileToPlay = _state.CurrentItem;
            }
            if (fileToPlay is null) return null;

            var outcome = await Launch(fileToPlay);

            return outcome.Status is LaunchStatus.Incompatible
                ? await NextCore() ?? outcome
                : outcome;
        }

        private async Task<ILaunchableItem?> GetNextSearchItem()
        {
            if (_state.SearchQuery is null) return null;

            var list = (await _storage.Search(_state.SearchQuery, TeensyFilterType.All)).ToList();

            return GetNextListItem(list);
        }

        private async Task<ILaunchableItem?> GetNextDirectoryItem()
        {
            if (_state.CurrentItem is null) return null;

            var currentPath = _state.CurrentItem.Path.GetUnixParentPath();
            var currentDirectory = await _storage.GetDirectory(currentPath);

            var compatibleFiles = currentDirectory.Files.Any(f => f.IsCompatible);

            if (!compatibleFiles) return null;

            var list = currentDirectory.Files.OfType<ILaunchableItem>().ToList();
            return GetNextListItem(list);
        }

        public ILaunchableItem? GetNextListItem(List<ILaunchableItem> list)
        {
            var unfilteredFiles = list;

            if (unfilteredFiles.Count == 0)
            {
                _alert.PublishError("Something went wrong.  I coudln't find any files in the target location.");
                return null;
            }

            var currentFile = unfilteredFiles.ToList().FirstOrDefault(f => f.Id == _state.CurrentItem?.Id);

            if (currentFile is null)
            {
                _alert.PublishError("Something went wrong.  I coudln't find the current file in the target location.");
                return null;
            }

            var unfilteredIndex = unfilteredFiles.IndexOf(currentFile);

            var filteredFiles = unfilteredFiles
                .Where(f => GetFilterFileTypes()
                    .Any(t => f.FileType == t))
                .ToList();

            if (filteredFiles.Count() == 0)
            {
                _alert.PublishError("There were no files matching your filter in the target location");
                return null;
            }
            if (unfilteredIndex > filteredFiles.Count - 1)
            {
                return filteredFiles.First();
            }
            var filteredIndex = filteredFiles.IndexOf(currentFile);

            if (filteredIndex != -1)
            {
                var index = filteredIndex < filteredFiles.Count - 1
                ? filteredIndex + 1
                : 0;

                return filteredFiles[index];
            }

            ILaunchableItem? candidate = null;

            for (int x = 0; x < filteredFiles.Count; x++)
            {
                var f = filteredFiles[x];

                var fIndex = unfilteredFiles.IndexOf(f);

                if (fIndex > unfilteredIndex)
                {
                    candidate = f;
                    continue;
                }
                else if (fIndex < unfilteredIndex)
                {
                    break;
                }
            }
            if (candidate is null)
            {
                return filteredFiles.First();
            }
            return candidate;
        }

        private void MaybeStartStream(ILaunchableItem fileItem)
        {
            if (fileItem is SongItem songItem && _state.SidTimer is SidTimer.SongLength)
            {
                StartStream(songItem.PlayLength);
                return;
            }
            if (_state.PlayTimer is not null)
            {
                StartStream(_state.PlayTimer.Value);
            }
        }

        private void StartStream(TimeSpan length)
        {
            _state.PlayState = PlayState.Playing;
            SetupTimerSubscription();
            _timerStarted = true;
            _timer.StartNewTimer(length);
        }

        private void SetupTimerSubscription()
        {
            _timerSubscription?.Dispose();

            _timerSubscription = _timer.TimerComplete.Subscribe(async _ =>
            {
                await PlayNext();
            });
        }

        public void StopStream()
        {
            EnsureRestored();

            if (_timerSubscription is not null)
            {
                _alert.Publish("Stopping Stream");
            }
            _state.PlayState = PlayState.Stopped;
            _timerSubscription?.Dispose();
            _timerSubscription = null;
        }

        public PlayerState GetState()
        {
            EnsureRestored();
            return _state with { };
        }

        public void SetSearchMode(string query)
        {
            EnsureRestored();
            _state = _state with
            {
                PlayMode = PlayMode.Search,
                SearchQuery = query
            };
        }

        public void SetDirectoryMode(string directoryPath)
        {
            EnsureRestored();
            _state = _state with
            {
                PlayMode = PlayMode.CurrentDirectory,
                FilterType = TeensyFilterType.All,
                ScopePath = directoryPath,
                SearchQuery = null
            };
            _alert.Publish("Switching filter to \"All\"");
        }

        public void SetRandomMode(string scopePath)
        {
            EnsureRestored();

            if (_state.PlayMode is not PlayMode.Random)
            {
                _randomHistory.Clear();
            }
            _state = _state with
            {
                PlayMode = PlayMode.Random,
                ScopePath = scopePath,
                SearchQuery = null
            };
        }

        public void SetFilter(TeensyFilterType filterType)
        {
            EnsureRestored();
            _state = _state with { FilterType = filterType };
        }

        public void SetDirectoryScope(string path)
        {
            EnsureRestored();
            _state = _state with { ScopePath = path };
        }

        public void SetStreamTime(TimeSpan? timespan)
        {
            EnsureRestored();
            _state = _state with { PlayTimer = timespan };

            if (_state.CurrentItem is SongItem && _state.SidTimer is SidTimer.SongLength)
            {
                return;
            }

            if (_state.PlayTimer is not null)
            {
                StopStream();
                StartStream(_state.PlayTimer.Value);
            }
        }

        public void SetSidTimer(SidTimer value)
        {
            EnsureRestored();
            _state = _state with { SidTimer = value };
        }

        public void SetStorage(TeensyStorageType storageType)
        {
            EnsureRestored();
            _state = _state with { StorageType = storageType };
            _storage.SwitchStorage(storageType);
        }

        public void UseStorage(TeensyStorageType storageType)
        {
            EnsureRestored();
            _state = _state with { StorageType = storageType };
            _storage.UseStorage(storageType);
        }

        private TeensyFileType[] GetFilterFileTypes()
        {
            var trSettings = _settingsService.GetSettings();
            return trSettings.GetFileTypes(_state.FilterType);
        }

        public async Task<LaunchOutcome> LaunchOnceAsync(ILaunchableItem item)
        {
            EnsureRestored();
            _state = _state with
            {
                CurrentItem = item,
                PlayState = PlayState.Playing,
                PlayMode = PlayMode.CurrentDirectory,
                FilterType = TeensyFilterType.All,
                ScopePath = item.Path.GetUnixParentPath(),
                SearchQuery = null
            };
            var outcome = await _launch.LaunchFile(_state.StorageType, item);

            if (outcome.Status is LaunchStatus.Launched)
            {
                var launched = outcome.Item ?? item;

                _state = _state with { CurrentItem = launched };
                Announce(launched);
            }
            else
            {
                _state = _state with { PlayState = PlayState.Stopped };
            }
            Persist();
            return outcome;
        }

        public async Task<LaunchOutcome> RandomOnceAsync(StorageScope scope, string startingDirectory, TeensyFilterType filter)
        {
            EnsureRestored();
            _state = _state with
            {
                Scope = scope,
                ScopePath = startingDirectory,
                FilterType = filter,
                SearchQuery = null
            };
            return await PickRandom(menu: false);
        }

        public Task TogglePlay() => Guarded(async () =>
        {
            EnsureRestored();

            if (_state.CurrentItem is null)
            {
                _alert.PublishError("Hit back and try starting a new stream.");
                return;
            }
            var result = await ToggleAsync();
            var name = result.Item?.Name;

            switch (result.Action)
            {
                case PlayToggleAction.Paused:
                    _timer.PauseTimer();
                    _alert.Publish($"{name} has been paused.");
                    break;

                case PlayToggleAction.Stopped:
                    _timer.PauseTimer();
                    _alert.Publish(result.Reason is null ? $"{name} has been stopped." : $"{name} has been stopped — {result.Reason}.");
                    break;

                case PlayToggleAction.Resumed:
                    if (_timerStarted) _timer.ResumeTimer();
                    _alert.Publish($"{name} has been resumed.");
                    break;

                case PlayToggleAction.Relaunched when result.Relaunch is { Status: LaunchStatus.Launched, Item: { } launched }:
                    MaybeStartStream(launched);
                    _alert.Publish($"{name} has been resumed.");
                    break;

                case PlayToggleAction.Relaunched when result.Reason is { } reason:
                    _alert.PublishError(reason);
                    break;
            }
        });

        public async Task<PlayToggleResult> ToggleAsync()
        {
            EnsureRestored();

            if (_state.CurrentItem is not { } current)
            {
                try
                {
                    await _devices.ToggleMusicAsync();
                }
                catch (TeensyApiException ex) when (ex.StatusCode == BadGateway)
                {
                    return await StopByReset(null, RefusedPauseReason);
                }
                return new PlayToggleResult(PlayToggleAction.Toggled, null, null, null);
            }

            return (_state.PlayState, current) switch
            {
                (PlayState.Playing, SongItem) => await SwitchMusic(current, PlayState.Paused, PlayToggleAction.Paused),
                (PlayState.Playing, _) => await StopByReset(current, NotPausableReason),
                (PlayState.Paused, SongItem) => await SwitchMusic(current, PlayState.Playing, PlayToggleAction.Resumed),
                _ => await Relaunch(current)
            };
        }

        /// <summary>Pauses or resumes the song on the device. A device that refuses is reset instead.</summary>
        private async Task<PlayToggleResult> SwitchMusic(ILaunchableItem song, PlayState to, PlayToggleAction action)
        {
            try
            {
                await _devices.ToggleMusicAsync();
            }
            catch (TeensyApiException ex) when (ex.StatusCode == BadGateway)
            {
                return await StopByReset(song, RefusedPauseReason);
            }
            _state = _state with { PlayState = to };
            Persist();

            return new PlayToggleResult(action, song, null, null);
        }

        private async Task<PlayToggleResult> StopByReset(ILaunchableItem? item, string reason)
        {
            await ResetDevice();

            return new PlayToggleResult(PlayToggleAction.Stopped, item, reason, null);
        }

        /// <summary>Launches the current file again: a reset device can't be toggled back, and a game can't be paused.</summary>
        private async Task<PlayToggleResult> Relaunch(ILaunchableItem current)
        {
            _storage.UseStorage(_state.StorageType);
            _state = _state with { PlayState = PlayState.Playing };

            var outcome = await _launch.LaunchFile(_state.StorageType, current);

            if (outcome.Status is LaunchStatus.Launched)
            {
                var launched = outcome.Item ?? current;

                _state = _state with { CurrentItem = launched };
                Persist();
                return new PlayToggleResult(PlayToggleAction.Relaunched, launched, null, outcome with { Item = launched });
            }
            outcome = Refused(outcome, $"Failed to launch {current.Name}.");
            Persist();

            return new PlayToggleResult(PlayToggleAction.Relaunched, current, outcome.Message, outcome);
        }

        public async Task<ILaunchableItem?> StopAsync()
        {
            EnsureRestored();

            var current = _state.CurrentItem;

            await ResetDevice();

            return current;
        }

        private async Task ResetDevice()
        {
            await _devices.ResetDeviceAsync(_devices.RequireDeviceId());

            _state = _state with { PlayState = PlayState.Stopped };
            Persist();
        }
    }
}
