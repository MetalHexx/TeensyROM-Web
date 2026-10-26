using NSubstitute;
using NSubstitute.ExceptionExtensions;
using AutoFixture;
using System.Reactive;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests
{
    /// <summary>
    /// The player starting from the device's last launch record, writing it again after what it does to the device, and
    /// the one-shot faces (<c>*Async</c>) that leave the play timer alone.
    /// </summary>
    public partial class PlayerServiceTests
    {
        private static readonly DeviceSummary Rack = new("dev-2", "Rack", true, "USB COM4", "Connected");

        private static long SizeOf(string path) => 100 + path.Sum(c => c);

        private static LaunchedFile Pick(string path) => new(path, SizeOf(path));

        private T Listed<T>(string path) where T : ILaunchableItem
        {
            var file = CreateFile<T>(path);
            file.Size = SizeOf(path);
            return file;
        }

        private static LastLaunchRecord Record(
            string? current = "/music/2.sid",
            PlayState state = PlayState.Playing,
            PlayMode mode = PlayMode.CurrentDirectory,
            TeensyStorageType storage = TeensyStorageType.SD,
            TeensyFilterType filter = TeensyFilterType.All,
            StorageScope scope = StorageScope.DirDeep,
            string scopePath = "/",
            string? query = null,
            IReadOnlyList<LaunchedFile>? picks = null,
            int index = -1,
            DeviceSummary? device = null) => new(
                (device ?? Bench).Id,
                (device ?? Bench).Name,
                storage,
                current is null ? null : Pick(current),
                mode,
                query,
                filter,
                scope,
                scopePath,
                state,
                picks ?? [],
                index);

        private PlayerService Restored(LastLaunchRecord record)
        {
            _store.Seed(record);
            return _fixture.Create<PlayerService>();
        }

        private void AssertTimerUntouched()
        {
            _progressTimer.DidNotReceive().StartNewTimer(Any<TimeSpan>());
            _progressTimer.DidNotReceive().PauseTimer();
            _progressTimer.DidNotReceive().ResumeTimer();
        }

        // ---- restoring ---------------------------------------------------------------------------------------------

        [Fact]
        public async Task Given_ARestoredFolderStream_When_NextAsync_Then_TheNextFileOfTheFolderLaunches()
        {
            //Arrange
            var (one, two, three) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"), Listed<SongItem>("/music/3.sid"));
            SetupStorageService(one, two, three);
            var player = Restored(Record(current: two.Path));

            //Act
            var outcome = await player.NextAsync();

            //Assert
            outcome!.Status.Should().Be(LaunchStatus.Launched);
            outcome.Item.Should().BeSameAs(three);
            await _launchService.Received(1).LaunchFile(TeensyStorageType.SD, three);
            player.GetState().CurrentItem.Should().BeSameAs(three);
            _store.Load(Bench.Id)!.Current.Should().Be(Pick(three.Path));
        }

        [Fact]
        public async Task Given_ARestoredFolderStream_When_PreviousAsync_Then_TheFileBeforeLaunches_WrappingAtTheStart()
        {
            //Arrange
            var (one, two, three) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"), Listed<SongItem>("/music/3.sid"));
            SetupStorageService(one, two, three);
            var player = Restored(Record(current: two.Path));

            //Act
            var before = await player.PreviousAsync();
            var wrapped = await player.PreviousAsync();

            //Assert
            before!.Item.Should().BeSameAs(one);
            wrapped!.Item.Should().BeSameAs(three);
        }

        [Fact]
        public async Task Given_ARestoredFileWhoseSizeDiffersFromTheListing_When_NextAsync_Then_ItIsNotFound_AndItLaunchesAgain()
        {
            //Arrange
            var (one, two) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"));
            SetupStorageService(one, two);
            var record = Record(current: two.Path);
            var player = Restored(record with { Current = new LaunchedFile(two.Path, two.Size + 1) });

            //Act
            await player.NextAsync();

            //Assert
            _alert.Received(1).PublishError(Arg.Is<string>(message => message.Contains("find the current file")));
            await _launchService.Received(1).LaunchFile(TeensyStorageType.SD, Arg.Is<ILaunchableItem>(item => item.Path == two.Path));
        }

        [Fact]
        public async Task Given_ARestoredSearchStream_When_NextAsyncAndPreviousAsync_Then_TheSearchResultsAreWalked()
        {
            //Arrange
            var (one, two, three) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"), Listed<SongItem>("/music/3.sid"));
            SetupSearchStorageService([one, two, three]);
            var player = Restored(Record(current: two.Path, mode: PlayMode.Search, query: "sid"));

            //Act
            var next = await player.NextAsync();
            var previous = await player.PreviousAsync();

            //Assert
            next!.Item.Should().BeSameAs(three);
            previous!.Item.Should().BeSameAs(two);
            await _storageService.Received().Search("sid", TeensyFilterType.All);
        }

        [Fact]
        public async Task Given_ARestoredRandomStream_When_NextAsync_Then_ThePickAfterTheCurrentOneInTheHistoryLaunches()
        {
            //Arrange
            var picks = new[] { Pick("/music/a.sid"), Pick("/music/b.sid"), Pick("/music/c.sid") };
            var player = Restored(Record(current: "/music/b.sid", mode: PlayMode.Random, picks: picks, index: 1));

            //Act
            var outcome = await player.NextAsync();

            //Assert
            outcome!.Item!.Path.Should().Be("/music/c.sid");
            await _launchService.DidNotReceiveWithAnyArgs().LaunchRandom(default, default, default!, default);
            var record = _store.Load(Bench.Id)!;
            record.RandomIndex.Should().Be(2);
            record.RandomPicks.Should().Equal(picks);
        }

        [Fact]
        public async Task Given_ARestoredRandomStreamAtTheEndOfItsHistory_When_NextAsync_Then_ANewPickIsMadeWithTheSameFilterScopeAndFolder()
        {
            //Arrange
            var picks = new[] { Pick("/music/a.sid"), Pick("/music/b.sid") };
            SetupRandom(Listed<SongItem>("/music/new.sid"));
            var player = Restored(Record(current: "/music/b.sid", mode: PlayMode.Random, picks: picks, index: 1,
                filter: TeensyFilterType.Music, scope: StorageScope.DirShallow, scopePath: "/music"));

            //Act
            var outcome = await player.NextAsync();

            //Assert
            outcome!.Item!.Path.Should().Be("/music/new.sid");
            await _launchService.Received(1).LaunchRandom(TeensyStorageType.SD, StorageScope.DirShallow, "/music", TeensyFilterType.Music);
            var record = _store.Load(Bench.Id)!;
            record.RandomPicks.Select(pick => pick.Path).Should().Equal("/music/a.sid", "/music/b.sid", "/music/new.sid");
            record.RandomIndex.Should().Be(2);
        }

        [Fact]
        public async Task Given_ARestoredRandomStream_When_PreviousAsync_Then_ThePicksAreWalkedBackThroughTheHistory()
        {
            //Arrange
            var picks = new[] { Pick("/music/a.sid"), Pick("/music/b.sid"), Pick("/music/c.sid") };
            var player = Restored(Record(current: "/music/c.sid", mode: PlayMode.Random, picks: picks, index: 2));

            //Act
            var first = await player.PreviousAsync();
            var indexAfterFirst = _store.Load(Bench.Id)!.RandomIndex;
            var second = await player.PreviousAsync();

            //Assert
            first!.Item!.Path.Should().Be("/music/b.sid");
            indexAfterFirst.Should().Be(1);
            second!.Item!.Path.Should().Be("/music/a.sid");
            _store.Load(Bench.Id)!.RandomIndex.Should().Be(0);
        }

        [Fact]
        public void Given_ARecord_When_TheStateIsRead_Then_ItIsTheRecordsState_WithTheStorageAppliedToTheStateOnly()
        {
            //Arrange
            var player = Restored(Record(
                current: "/music/2.sid", state: PlayState.Paused, mode: PlayMode.Search, storage: TeensyStorageType.USB,
                filter: TeensyFilterType.Music, scope: StorageScope.Storage, scopePath: "/music", query: "sid"));

            //Act
            var state = player.GetState();

            //Assert
            state.Should().BeEquivalentTo(new PlayerState
            {
                StorageType = TeensyStorageType.USB,
                PlayState = PlayState.Paused,
                PlayMode = PlayMode.Search,
                FilterType = TeensyFilterType.Music,
                Scope = StorageScope.Storage,
                ScopePath = "/music",
                SearchQuery = "sid"
            }, options => options.Excluding(s => s.CurrentItem));
            state.CurrentItem!.Path.Should().Be("/music/2.sid");
            state.CurrentItem.Size.Should().Be(SizeOf("/music/2.sid"));
            _storageService.DidNotReceiveWithAnyArgs().UseStorage(default);
            _storageService.DidNotReceiveWithAnyArgs().SwitchStorage(default);
        }

        [Fact]
        public async Task Given_ARestoredUsbStream_When_NextAsync_Then_TheStorageServiceIsAlignedBeforeItIsRead()
        {
            //Arrange
            var (one, two) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"));
            SetupStorageService(one, two);
            var player = Restored(Record(current: one.Path, storage: TeensyStorageType.USB));
            player.GetState();
            _storageService.DidNotReceiveWithAnyArgs().UseStorage(default);

            //Act
            await player.NextAsync();

            //Assert
            _storageService.Received().UseStorage(TeensyStorageType.USB);
            await _launchService.Received(1).LaunchFile(TeensyStorageType.USB, two);
        }

        [Fact]
        public void Given_ARecord_When_ASetterRunsFirst_Then_ItWinsOverTheRestoredValue_AndTheRestOfTheRecordStays()
        {
            //Arrange
            var player = Restored(Record(filter: TeensyFilterType.Music, scopePath: "/music", state: PlayState.Paused));

            //Act
            player.SetFilter(TeensyFilterType.Games);

            //Assert
            var state = player.GetState();
            state.FilterType.Should().Be(TeensyFilterType.Games);
            state.ScopePath.Should().Be("/music");
            state.PlayState.Should().Be(PlayState.Paused);
            state.CurrentItem!.Path.Should().Be("/music/2.sid");
        }

        [Fact]
        public async Task Given_ARestoredRandomStream_When_RandomModeIsSetAndPlayPreviousRuns_Then_TheRestoredHistoryIsStillThere()
        {
            //Arrange
            var picks = new[] { Pick("/music/a.sid"), Pick("/music/b.sid") };
            var player = Restored(Record(current: "/music/b.sid", mode: PlayMode.Random, picks: picks, index: 1));

            //Act
            player.SetRandomMode("/games");
            await player.PlayPrevious();

            //Assert
            player.GetState().CurrentItem!.Path.Should().Be("/music/a.sid");
            player.GetState().ScopePath.Should().Be("/games");
        }

        [Fact]
        public void Given_TwoDevices_When_TheSelectedOneChanges_Then_TheNewDevicesRecordIsRestored()
        {
            //Arrange
            _store.Seed(Record(current: "/music/2.sid", filter: TeensyFilterType.Music));
            _store.Seed(Record(current: "/games/g.crt", filter: TeensyFilterType.Games, device: Rack));
            var player = _fixture.Create<PlayerService>();
            player.GetState().FilterType.Should().Be(TeensyFilterType.Music);

            //Act
            _deviceService.SelectedDevice.Returns(Rack);
            var state = player.GetState();

            //Assert
            state.FilterType.Should().Be(TeensyFilterType.Games);
            state.CurrentItem!.Path.Should().Be("/games/g.crt");
        }

        [Fact]
        public void Given_NoRecord_When_TheStateIsRead_Then_ItIsTheDefaultState()
        {
            var player = _fixture.Create<PlayerService>();

            player.GetState().CurrentItem.Should().BeNull();
            player.GetState().PlayState.Should().Be(PlayState.Stopped);
            _store.SaveCount.Should().Be(0);
        }

        // ---- writing the record ------------------------------------------------------------------------------------

        [Fact]
        public async Task When_AFileIsLaunched_Then_TheRecordHoldsTheWholeState()
        {
            //Arrange
            var song = Listed<SongItem>("/music/1.sid");
            SetupStorageService(song);
            var player = _fixture.Create<PlayerService>();
            player.SetDirectoryMode("/music/");
            player.SetFilter(TeensyFilterType.Music);

            //Act
            await player.LaunchFromDirectory(song.Path);

            //Assert
            _store.Load(Bench.Id).Should().BeEquivalentTo(new
            {
                DeviceId = Bench.Id,
                DeviceName = Bench.Name,
                Storage = TeensyStorageType.SD,
                Current = Pick(song.Path) with { Size = song.Size },
                Mode = PlayMode.CurrentDirectory,
                Filter = TeensyFilterType.Music,
                Scope = StorageScope.DirDeep,
                ScopePath = "/music/",
                PlayState = PlayState.Playing
            });
        }

        [Fact]
        public async Task When_ALaunchIsSkippedOrRefused_Then_ThatAttemptIsRecordedToo()
        {
            //Arrange
            var (one, two) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"));
            SetupStorageService(one, two);
            SetupLaunch(two);
            var player = _fixture.Create<PlayerService>();
            player.SetDirectoryMode("/music/");

            //Act
            await player.LaunchFromDirectory(two.Path);

            //Assert
            _store.SaveCount.Should().Be(2, "the skipped file and the one it moved on to");

            //Act
            _launchService.LaunchFile(Any<TeensyStorageType>(), one).Returns(Outcome(LaunchStatus.Failed, null, "The device is busy."));
            await player.PlayNext();

            //Assert
            _store.SaveCount.Should().Be(4, "the already skipped file again, and the refusal of the one after it");
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Stopped);
        }

        [Fact]
        public async Task When_ASongIsToggledAndStopped_Then_EachOutcomeIsRecorded()
        {
            //Arrange
            var song = Listed<SongItem>("/music/1.sid");
            SetupStorageService(song);
            var player = _fixture.Create<PlayerService>();
            await player.LaunchFromDirectory(song.Path);
            var saves = _store.SaveCount;

            //Act
            await player.TogglePlay();
            var paused = _store.Load(Bench.Id)!.PlayState;
            await player.TogglePlay();
            var resumed = _store.Load(Bench.Id)!.PlayState;
            await player.StopAsync();

            //Assert
            paused.Should().Be(PlayState.Paused);
            resumed.Should().Be(PlayState.Playing);
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Stopped);
            _store.SaveCount.Should().Be(saves + 3);
        }

        [Fact]
        public void When_StreamsAreStoppedOrSettingsChange_Then_NothingIsWritten()
        {
            //Arrange
            var player = Restored(Record());

            //Act
            player.StopStream();
            player.SetFilter(TeensyFilterType.Music);
            player.SetSearchMode("sid");
            player.SetDirectoryMode("/music/");
            player.SetRandomMode("/music/");
            player.SetDirectoryScope("/games/");
            player.SetStreamTime(TimeSpan.FromMinutes(2));
            player.SetSidTimer(SidTimer.TimerOverride);
            player.SetStorage(TeensyStorageType.USB);
            player.UseStorage(TeensyStorageType.SD);
            player.GetState();

            //Assert
            _store.SaveCount.Should().Be(0);
        }

        [Fact]
        public async Task Given_NoSelectedDevice_When_AFileIsLaunched_Then_NothingIsWritten()
        {
            //Arrange
            var song = Listed<SongItem>("/music/1.sid");
            SetupStorageService(song);
            _deviceService.SelectedDevice.Returns((DeviceSummary?)null);
            var player = _fixture.Create<PlayerService>();

            //Act
            await player.LaunchFromDirectory(song.Path);

            //Assert
            _store.SaveCount.Should().Be(0);
        }

        // ---- the toggle decision -----------------------------------------------------------------------------------

        [Fact]
        public async Task Given_APlayingSong_When_ToggleAsync_Then_ItIsPaused()
        {
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Playing));

            var result = await player.ToggleAsync();

            result.Action.Should().Be(PlayToggleAction.Paused);
            result.Item!.Path.Should().Be("/music/1.sid");
            result.Reason.Should().BeNull();
            await _deviceService.Received(1).ToggleMusicAsync();
            await _deviceService.DidNotReceive().ResetDeviceAsync(Any<string>(), Any<CancellationToken>());
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Paused);
        }

        [Fact]
        public async Task Given_APlayingGame_When_ToggleAsync_Then_ItIsStoppedByResettingTheDevice()
        {
            var player = Restored(Record(current: "/games/g.crt", state: PlayState.Playing));

            var result = await player.ToggleAsync();

            result.Action.Should().Be(PlayToggleAction.Stopped);
            result.Reason.Should().Be("games and programs can't be paused, so it was stopped by resetting the device");
            await _deviceService.Received(1).ResetDeviceAsync(Bench.Id, Any<CancellationToken>());
            await _deviceService.DidNotReceive().ToggleMusicAsync();
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Stopped);
        }

        [Fact]
        public async Task Given_APausedSong_When_ToggleAsync_Then_ItResumes()
        {
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Paused));

            var result = await player.ToggleAsync();

            result.Action.Should().Be(PlayToggleAction.Resumed);
            await _deviceService.Received(1).ToggleMusicAsync();
            await _launchService.DidNotReceiveWithAnyArgs().LaunchFile(default, default!);
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Playing);
        }

        [Theory]
        [InlineData("/games/g.crt", "Paused")]
        [InlineData("/games/g.crt", "Stopped")]
        [InlineData("/music/1.sid", "Stopped")]
        public async Task Given_SomethingStoppedOrAGamePaused_When_ToggleAsync_Then_ItLaunchesAgain_WithoutTogglingMusic(string path, string state)
        {
            var player = Restored(Record(current: path, state: Enum.Parse<PlayState>(state)));

            var result = await player.ToggleAsync();

            result.Action.Should().Be(PlayToggleAction.Relaunched);
            result.Relaunch!.Status.Should().Be(LaunchStatus.Launched);
            result.Item!.Path.Should().Be(path);
            await _launchService.Received(1).LaunchFile(TeensyStorageType.SD, Arg.Is<ILaunchableItem>(item => item.Path == path));
            await _deviceService.DidNotReceive().ToggleMusicAsync();
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Playing);
        }

        [Fact]
        public async Task Given_ARelaunchTheEngineAnswersWithItsRecord_When_ToggleAsync_Then_ThatRecordIsTheCurrentFile()
        {
            var engineRecord = Listed<SongItem>("/music/1.sid");
            _launchService.LaunchFile(Any<TeensyStorageType>(), Any<ILaunchableItem>()).Returns(Outcome(LaunchStatus.Launched, engineRecord));
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Stopped));

            var result = await player.ToggleAsync();

            result.Item.Should().BeSameAs(engineRecord);
            player.GetState().CurrentItem.Should().BeSameAs(engineRecord);
        }

        [Fact]
        public async Task Given_ARelaunchTheUnitCantRun_When_ToggleAsync_Then_ItIsReportedAndTheStateIsStopped()
        {
            _launchService.LaunchFile(Any<TeensyStorageType>(), Any<ILaunchableItem>()).Returns(Outcome(LaunchStatus.Incompatible, null, "That PRG needs a REU."));
            var player = Restored(Record(current: "/games/g.prg", state: PlayState.Stopped));

            var result = await player.ToggleAsync();

            result.Action.Should().Be(PlayToggleAction.Relaunched);
            result.Relaunch!.Status.Should().Be(LaunchStatus.Incompatible);
            result.Reason.Should().Be("That PRG needs a REU.");
            player.GetState().PlayState.Should().Be(PlayState.Stopped);
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Stopped);
        }

        [Theory]
        [InlineData("/music/1.sid", "Playing")]
        [InlineData("/music/1.sid", "Paused")]
        public async Task Given_TheDeviceRefusesToPause_When_ToggleAsync_Then_ItFallsBackToAResetWithTheReason(string path, string state)
        {
            _deviceService.ToggleMusicAsync().Returns(Task.FromException(new TeensyApiException("The TeensyROM did not answer.", 502)));
            var player = Restored(Record(current: path, state: Enum.Parse<PlayState>(state)));

            var result = await player.ToggleAsync();

            result.Action.Should().Be(PlayToggleAction.Stopped);
            result.Reason.Should().StartWith("the TeensyROM refused to pause").And.EndWith("so it was stopped by resetting the device");
            await _deviceService.Received(1).ResetDeviceAsync(Bench.Id, Any<CancellationToken>());
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Stopped);
        }

        [Theory]
        [InlineData(404)]
        [InlineData(400)]
        [InlineData(null)]
        public async Task Given_TheToggleFailsForAnotherReason_When_ToggleAsync_Then_ItThrows_WithoutAResetOrAWrite(int? status)
        {
            _deviceService.ToggleMusicAsync().Returns(Task.FromException(new TeensyApiException("The device abc was not found.", status)));
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Playing));

            var toggle = () => player.ToggleAsync();

            (await toggle.Should().ThrowAsync<TeensyApiException>()).Which.StatusCode.Should().Be(status);
            await _deviceService.DidNotReceive().ResetDeviceAsync(Any<string>(), Any<CancellationToken>());
            _store.SaveCount.Should().Be(0);
            player.GetState().PlayState.Should().Be(PlayState.Playing);
        }

        [Fact]
        public async Task Given_NothingIsKnownAboutTheDevice_When_ToggleAsync_Then_ABareToggleIsSent_AndNothingIsChangedOrWritten()
        {
            var player = _fixture.Create<PlayerService>();
            var before = player.GetState();

            var result = await player.ToggleAsync();

            result.Should().BeEquivalentTo(new PlayToggleResult(PlayToggleAction.Toggled, null, null, null));
            await _deviceService.Received(1).ToggleMusicAsync();
            player.GetState().Should().BeEquivalentTo(before);
            _store.SaveCount.Should().Be(0);
        }

        [Fact]
        public async Task Given_NoCurrentFile_When_TheMenuToggles_Then_ItAlertsAndSendsNothing()
        {
            var player = _fixture.Create<PlayerService>();

            await player.TogglePlay();

            _alert.Received(1).PublishError("Hit back and try starting a new stream.");
            await _deviceService.DidNotReceive().ToggleMusicAsync();
            await _deviceService.DidNotReceive().ResetDeviceAsync(Any<string>(), Any<CancellationToken>());
            _store.SaveCount.Should().Be(0);
        }

        [Fact]
        public async Task Given_TheDeviceRefusesToPause_When_TheMenuToggles_Then_TheDeviceIsResetAndTheReasonIsPublished()
        {
            _deviceService.ToggleMusicAsync().Returns(Task.FromException(new TeensyApiException("The TeensyROM did not answer.", 502)));
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Playing));

            await player.TogglePlay();

            await _deviceService.Received(1).ResetDeviceAsync(Bench.Id, Any<CancellationToken>());
            _alert.Received(1).Publish(Arg.Is<string>(message => message.StartsWith("1.sid has been stopped") && message.Contains("refused to pause")));
            _alert.DidNotReceive().PublishError(Any<string>());
            player.GetState().PlayState.Should().Be(PlayState.Stopped);
            _progressTimer.Received(1).PauseTimer();
        }

        [Fact]
        public async Task When_StopAsync_Then_TheDeviceIsResetAndTheStopIsRecorded()
        {
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Playing));

            var stopped = await player.StopAsync();

            stopped!.Path.Should().Be("/music/1.sid");
            await _deviceService.Received(1).ResetDeviceAsync(Bench.Id, Any<CancellationToken>());
            player.GetState().PlayState.Should().Be(PlayState.Stopped);
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Stopped);
            AssertTimerUntouched();
        }

        [Fact]
        public async Task Given_NothingIsKnownAboutTheDevice_When_StopAsync_Then_TheDeviceIsStillReset()
        {
            var player = _fixture.Create<PlayerService>();

            var stopped = await player.StopAsync();

            stopped.Should().BeNull();
            await _deviceService.Received(1).ResetDeviceAsync(Bench.Id, Any<CancellationToken>());
        }

        // ---- the one-shot faces and the timer ----------------------------------------------------------------------

        [Fact]
        public async Task Given_ARestoredPausedSong_When_ToggleAsync_Then_NothingTouchesTheTimer_AndNothingAdvances()
        {
            var timer = SetupTimer();
            SetupStorageService(Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"));
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Paused));

            await player.ToggleAsync();
            timer.OnNext(Unit.Default);

            AssertTimerUntouched();
            await _launchService.DidNotReceiveWithAnyArgs().LaunchFile(default, default!);
            await _storageService.DidNotReceiveWithAnyArgs().GetDirectory(default!);
        }

        [Fact]
        public async Task Given_ARestoredStoppedGame_When_ToggleAsync_Then_ItLaunchesOnce_AndTheTimerIsUntouched()
        {
            var timer = SetupTimer();
            var player = Restored(Record(current: "/games/g.crt", state: PlayState.Stopped));
            player.SetStreamTime(null);

            await player.ToggleAsync();
            timer.OnNext(Unit.Default);

            AssertTimerUntouched();
            await _launchService.Received(1).LaunchFile(Any<TeensyStorageType>(), Any<ILaunchableItem>());
        }

        [Fact]
        public async Task When_NextAsyncLaunchesASong_Then_NoTimerIsStarted_AndTheLaunchIsPublished()
        {
            var timer = SetupTimer();
            var (one, two) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"));
            SetupStorageService(one, two);
            var player = Restored(Record(current: one.Path));
            var launched = new List<ILaunchableItem>();
            player.FileLaunched.Subscribe(launched.Add);

            await player.NextAsync();
            timer.OnNext(Unit.Default);

            AssertTimerUntouched();
            launched.Should().Equal(two);
            await _launchService.Received(1).LaunchFile(Any<TeensyStorageType>(), Any<ILaunchableItem>());
        }

        [Fact]
        public async Task When_LaunchOnceAsyncAndRandomOnceAsyncRun_Then_NoTimerIsStarted()
        {
            var song = Listed<SongItem>("/music/1.sid");
            SetupRandom(Listed<SongItem>("/music/2.sid"));
            var player = _fixture.Create<PlayerService>();

            await player.LaunchOnceAsync(song);
            await player.RandomOnceAsync(StorageScope.DirDeep, "/", TeensyFilterType.All);

            AssertTimerUntouched();
        }

        [Fact]
        public async Task Given_ARestoredPausedSong_When_TheMenuTogglesThreeTimes_Then_TheTimerIsNeverResumedOrStarted_AndNothingRelaunches()
        {
            var timer = SetupTimer();
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Paused));

            await player.TogglePlay();
            await player.TogglePlay();
            await player.TogglePlay();
            timer.OnNext(Unit.Default);

            _progressTimer.DidNotReceive().ResumeTimer();
            _progressTimer.DidNotReceive().StartNewTimer(Any<TimeSpan>());
            _progressTimer.Received(1).PauseTimer();
            await _deviceService.Received(3).ToggleMusicAsync();
            await _launchService.DidNotReceiveWithAnyArgs().LaunchFile(default, default!);
        }

        [Fact]
        public async Task Given_ARestoredStoppedGame_When_TheMenuResumesIt_Then_AFreshTimerStarts_AndTheOldOneIsNotResumed()
        {
            var player = Restored(Record(current: "/games/g.crt", state: PlayState.Stopped));
            player.SetStreamTime(TimeSpan.FromMinutes(5));
            player.StopStream();
            _progressTimer.ClearReceivedCalls();

            await player.TogglePlay();

            _progressTimer.Received(1).StartNewTimer(TimeSpan.FromMinutes(5));
            _progressTimer.DidNotReceive().ResumeTimer();
            await _launchService.Received(1).LaunchFile(Any<TeensyStorageType>(), Any<ILaunchableItem>());
        }

        [Fact]
        public async Task Given_ARestoredStream_When_TheMenuGoesNextThenPausesAndResumes_Then_TheTimerFollowsAsItDoesToday()
        {
            var (one, two) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"));
            SetupStorageService(one, two);
            var player = Restored(Record(current: one.Path));

            await player.PlayNext();
            await player.TogglePlay();
            await player.TogglePlay();

            _progressTimer.Received(1).StartNewTimer(two.PlayLength);
            _progressTimer.Received(1).PauseTimer();
            _progressTimer.Received(1).ResumeTimer();
        }

        [Fact]
        public void Given_ARestoredStream_When_TheTimerCompletes_Then_ItDoesNotAdvance()
        {
            var timer = SetupTimer();
            SetupStorageService(Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"));
            var player = Restored(Record(current: "/music/1.sid", state: PlayState.Playing));

            player.GetState();
            timer.OnNext(Unit.Default);

            _launchService.ReceivedCalls().Should().BeEmpty();
            _storageService.DidNotReceiveWithAnyArgs().GetDirectory(default!);
        }

        // ---- random scope ------------------------------------------------------------------------------------------

        [Fact]
        public async Task Given_ARestoredStorageScope_When_PlayRandom_Then_ThePlayerPicksFromTheDirectoryAndBelow()
        {
            var player = Restored(Record(scope: StorageScope.Storage, scopePath: "/music", mode: PlayMode.Random));

            var outcome = await player.PlayRandom();

            outcome!.Status.Should().Be(LaunchStatus.Launched);
            await _launchService.Received(1).LaunchRandom(TeensyStorageType.SD, StorageScope.DirDeep, "/music", TeensyFilterType.All);
            player.GetState().Scope.Should().Be(StorageScope.DirDeep);
        }

        [Fact]
        public async Task Given_ARestoredStorageScope_When_NextAsyncContinuesTheRandomStream_Then_TheRestoredScopeIsKept()
        {
            var player = Restored(Record(scope: StorageScope.Storage, mode: PlayMode.Random));

            await player.NextAsync();

            await _launchService.Received(1).LaunchRandom(TeensyStorageType.SD, StorageScope.Storage, "/", TeensyFilterType.All);
        }

        [Fact]
        public async Task When_PlayRandomFailsToReachTrWeb_Then_ItAnswersNull_AndThePlayerStops()
        {
            _launchService
                .LaunchRandom(Any<TeensyStorageType>(), Any<StorageScope>(), Any<string>(), Any<TeensyFilterType>())
                .ThrowsAsync(new TeensyApiException("tr-web stopped answering."));
            var player = _fixture.Create<PlayerService>();

            var outcome = await player.PlayRandom();

            outcome.Should().BeNull();
            _alert.Received(1).PublishError("tr-web stopped answering.");
            player.GetState().PlayState.Should().Be(PlayState.Stopped);
        }

        // ---- launching and picking once ----------------------------------------------------------------------------

        [Fact]
        public async Task When_LaunchOnceAsync_Then_TheFilesFolderIsPlayedInDirectoryModeWithEveryType_AndTheLaunchIsRecorded()
        {
            var song = Listed<SongItem>("/music/sub/1.sid");
            var player = Restored(Record(mode: PlayMode.Random, filter: TeensyFilterType.Music, state: PlayState.Stopped, storage: TeensyStorageType.USB));

            var outcome = await player.LaunchOnceAsync(song);

            outcome.Status.Should().Be(LaunchStatus.Launched);
            var state = player.GetState();
            state.PlayMode.Should().Be(PlayMode.CurrentDirectory);
            state.FilterType.Should().Be(TeensyFilterType.All);
            state.ScopePath.Should().Be("/music/sub/");
            state.PlayState.Should().Be(PlayState.Playing);
            state.CurrentItem.Should().BeSameAs(song);
            await _launchService.Received(1).LaunchFile(TeensyStorageType.USB, song);
            _alert.DidNotReceive().Publish("Switching filter to \"All\"");
            _store.Load(Bench.Id).Should().BeEquivalentTo(Record(current: song.Path, mode: PlayMode.CurrentDirectory, filter: TeensyFilterType.All, scopePath: "/music/sub/", storage: TeensyStorageType.USB) with { Current = Pick(song.Path) with { Size = song.Size } });
        }

        [Fact]
        public async Task When_LaunchOnceAsyncGetsTheEnginesRecord_Then_ThatRecordIsCurrentAndPublished()
        {
            var requested = Listed<SongItem>("/music/1.sid");
            var engineRecord = Listed<SongItem>("/music/1.sid");
            _launchService.LaunchFile(Any<TeensyStorageType>(), requested).Returns(Outcome(LaunchStatus.Launched, engineRecord));
            var player = _fixture.Create<PlayerService>();
            var published = new List<ILaunchableItem>();
            player.FileLaunched.Subscribe(published.Add);

            var outcome = await player.LaunchOnceAsync(requested);

            outcome.Item.Should().BeSameAs(engineRecord);
            player.GetState().CurrentItem.Should().BeSameAs(engineRecord);
            published.Should().Equal(engineRecord);
        }

        [Theory]
        [InlineData("Incompatible")]
        [InlineData("NotFound")]
        [InlineData("Failed")]
        public async Task When_LaunchOnceAsyncDoesNotLaunch_Then_TheOutcomeIsReturnedAsIs_NothingIsSkipped_AndTheStateIsStopped(string status)
        {
            var (one, two) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"));
            SetupStorageService(one, two);
            var expected = Outcome(Enum.Parse<LaunchStatus>(status), one, "Said so.");
            _launchService.LaunchFile(Any<TeensyStorageType>(), one).Returns(expected);
            var player = _fixture.Create<PlayerService>();

            var outcome = await player.LaunchOnceAsync(one);

            outcome.Should().BeSameAs(expected);
            await _launchService.Received(1).LaunchFile(Any<TeensyStorageType>(), Any<ILaunchableItem>());
            await _storageService.DidNotReceiveWithAnyArgs().GetDirectory(default!);
            _alert.DidNotReceiveWithAnyArgs().PublishError(default!);
            player.GetState().PlayState.Should().Be(PlayState.Stopped);
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Stopped);
        }

        [Fact]
        public async Task When_RecordLaunchedForALaunch_Then_ItIsPlayingInDirectoryMode_PublishedAndPersisted_WithoutLaunching()
        {
            var song = Listed<SongItem>("/music/sub/1.sid");
            var player = Restored(Record(mode: PlayMode.Random, filter: TeensyFilterType.Music, state: PlayState.Stopped, storage: TeensyStorageType.USB));
            var published = new List<ILaunchableItem>();
            player.FileLaunched.Subscribe(published.Add);

            player.RecordLaunched(song, LaunchStatus.Launched);

            var state = player.GetState();
            state.PlayMode.Should().Be(PlayMode.CurrentDirectory);
            state.FilterType.Should().Be(TeensyFilterType.All);
            state.ScopePath.Should().Be("/music/sub/");
            state.PlayState.Should().Be(PlayState.Playing);
            state.CurrentItem.Should().BeSameAs(song);
            published.Should().Equal(song);
            await _launchService.DidNotReceiveWithAnyArgs().LaunchFile(default, default!);
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Playing);
        }

        [Fact]
        public void When_RecordLaunchedForAnIncompatibleFile_Then_ItIsStopped_AndNothingIsPublished()
        {
            var song = Listed<SongItem>("/music/1.sid");
            var player = Restored(Record(state: PlayState.Playing));
            var published = new List<ILaunchableItem>();
            player.FileLaunched.Subscribe(published.Add);

            player.RecordLaunched(song, LaunchStatus.Incompatible);

            player.GetState().PlayState.Should().Be(PlayState.Stopped);
            player.GetState().CurrentItem.Should().BeSameAs(song);
            published.Should().BeEmpty();
            _store.Load(Bench.Id)!.PlayState.Should().Be(PlayState.Stopped);
        }

        [Fact]
        public async Task When_RandomOnceAsyncRunsTwice_Then_BothPicksAreInTheHistory_AndNextAsyncWalksFromTheLast()
        {
            var (first, second) = (Listed<SongItem>("/music/first.sid"), Listed<SongItem>("/music/second.sid"));
            _launchService.LaunchRandom(Any<TeensyStorageType>(), Any<StorageScope>(), Any<string>(), Any<TeensyFilterType>())
                .Returns(Outcome(LaunchStatus.Launched, first), Outcome(LaunchStatus.Launched, second));
            var player = _fixture.Create<PlayerService>();

            await player.RandomOnceAsync(StorageScope.DirShallow, "/music", TeensyFilterType.Music);
            await player.RandomOnceAsync(StorageScope.DirShallow, "/music", TeensyFilterType.Music);

            await _launchService.Received(2).LaunchRandom(TeensyStorageType.SD, StorageScope.DirShallow, "/music", TeensyFilterType.Music);
            var record = _store.Load(Bench.Id)!;
            record.Mode.Should().Be(PlayMode.Random);
            record.Scope.Should().Be(StorageScope.DirShallow);
            record.ScopePath.Should().Be("/music");
            record.Filter.Should().Be(TeensyFilterType.Music);
            record.RandomPicks.Select(pick => pick.Path).Should().Equal(first.Path, second.Path);
            record.RandomIndex.Should().Be(1);

            var previous = await player.PreviousAsync();
            previous!.Item!.Path.Should().Be(first.Path);
        }

        [Fact]
        public async Task Given_ADirectoryStreamWithOldPicks_When_RandomOnceAsync_Then_TheHistoryStartsOver()
        {
            var pick = Listed<SongItem>("/music/new.sid");
            SetupRandom(pick);
            var player = Restored(Record(mode: PlayMode.CurrentDirectory, picks: [Pick("/music/old.sid")], index: 0));

            await player.RandomOnceAsync(StorageScope.DirDeep, "/", TeensyFilterType.All);

            _store.Load(Bench.Id)!.RandomPicks.Select(p => p.Path).Should().Equal(pick.Path);
        }

        [Fact]
        public async Task When_RandomOnceAsyncPicksAFileTheUnitCantRun_Then_ItIsReturned_NotSkipped_AndNotAddedToTheHistory()
        {
            var bad = Listed<SongItem>("/music/bad.sid");
            var expected = Outcome(LaunchStatus.Incompatible, bad, "That SID needs more RAM.");
            _launchService.LaunchRandom(Any<TeensyStorageType>(), Any<StorageScope>(), Any<string>(), Any<TeensyFilterType>()).Returns(expected);
            var player = _fixture.Create<PlayerService>();

            var outcome = await player.RandomOnceAsync(StorageScope.DirDeep, "/", TeensyFilterType.All);

            outcome.Should().BeSameAs(expected);
            await _launchService.Received(1).LaunchRandom(Any<TeensyStorageType>(), Any<StorageScope>(), Any<string>(), Any<TeensyFilterType>());
            await _launchService.DidNotReceiveWithAnyArgs().LaunchFile(default, default!);
            _alert.DidNotReceiveWithAnyArgs().PublishError(default!);
            _store.Load(Bench.Id)!.RandomPicks.Should().BeEmpty();
            player.GetState().PlayState.Should().Be(PlayState.Stopped);
        }

        [Fact]
        public async Task When_RandomOnceAsyncFindsNoFiles_Then_TheOutcomeIsReturned_AndThePlayerAndItsRecordAreAsTheyWere()
        {
            var expected = Outcome(LaunchStatus.NotFound, null, LaunchOutcome.NoFilesFoundMessage);
            _launchService.LaunchRandom(Any<TeensyStorageType>(), Any<StorageScope>(), Any<string>(), Any<TeensyFilterType>()).Returns(expected);
            var seeded = Record(current: "/music/1.sid", state: PlayState.Playing, mode: PlayMode.Random, picks: [Pick("/music/a.sid")], index: 0);
            var player = Restored(seeded);
            var before = player.GetState();

            var outcome = await player.RandomOnceAsync(StorageScope.DirShallow, "/games", TeensyFilterType.Images);

            outcome.Should().BeSameAs(expected);
            await _launchService.Received(1).LaunchRandom(TeensyStorageType.SD, StorageScope.DirShallow, "/games", TeensyFilterType.Images);
            _alert.DidNotReceiveWithAnyArgs().PublishError(default!);
            _store.SaveCount.Should().Be(0);
            _store.Load(Bench.Id).Should().BeEquivalentTo(seeded);
            player.GetState().Should().BeEquivalentTo(before);
        }

        [Theory]
        [InlineData(PlayMode.CurrentDirectory, null)]
        [InlineData(PlayMode.Search, "sid")]
        public async Task Given_AFolderOrSearchStreamWithOldPicks_When_RandomOnceAsyncFindsNoFiles_Then_TheStreamAndItsHistoryAreAsTheyWere(PlayMode mode, string? query)
        {
            _launchService
                .LaunchRandom(Any<TeensyStorageType>(), Any<StorageScope>(), Any<string>(), Any<TeensyFilterType>())
                .Returns(Outcome(LaunchStatus.NotFound, null, LaunchOutcome.NoFilesFoundMessage));
            var seeded = Record(current: "/music/2.sid", mode: mode, query: query, filter: TeensyFilterType.Music, scope: StorageScope.DirShallow,
                scopePath: "/music/", picks: [Pick("/music/old.sid")], index: 0);
            var player = Restored(seeded);

            await player.RandomOnceAsync(StorageScope.DirDeep, "/", TeensyFilterType.Images);

            _store.SaveCount.Should().Be(0);
            _store.Load(Bench.Id).Should().BeEquivalentTo(seeded);
            player.GetState().Should().BeEquivalentTo(new PlayerState
            {
                PlayMode = mode,
                SearchQuery = query,
                FilterType = TeensyFilterType.Music,
                Scope = StorageScope.DirShallow,
                ScopePath = "/music/",
                PlayState = PlayState.Playing
            }, options => options.Excluding(state => state.CurrentItem));
            _launchHistory.Items.Select(pick => pick.Path).Should().Equal("/music/old.sid");
            _launchHistory.CurrentIndex.Should().Be(0);
        }

        // ---- skipping files the unit can't run ---------------------------------------------------------------------

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Given_AFolderHoldingOneIncompatibleFile_When_StepAsync_Then_ItIsTriedOnce_AndTheIncompatibleOutcomeIsReturned(bool forward)
        {
            var only = Listed<SongItem>("/music/1.sid");
            SetupStorageService(only);
            SetupLaunch(only);
            var player = Restored(Record(current: only.Path));

            var outcome = forward ? await player.NextAsync() : await player.PreviousAsync();

            outcome!.Status.Should().Be(LaunchStatus.Incompatible);
            outcome.Item.Should().BeSameAs(only);
            await _launchService.Received(1).LaunchFile(Any<TeensyStorageType>(), Any<ILaunchableItem>());
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Given_AFolderWhereNothingCanLaunch_When_StepAsync_Then_EachFileIsTriedOnce_AndTheLastIncompatibleOutcomeIsReturned(bool forward)
        {
            var (one, two, three) = (Listed<SongItem>("/music/1.sid"), Listed<SongItem>("/music/2.sid"), Listed<SongItem>("/music/3.sid"));
            SetupStorageService(one, two, three);
            SetupLaunch(one, two, three);
            var player = Restored(Record(current: two.Path));

            var outcome = forward ? await player.NextAsync() : await player.PreviousAsync();

            outcome!.Status.Should().Be(LaunchStatus.Incompatible);
            await _launchService.Received(3).LaunchFile(Any<TeensyStorageType>(), Any<ILaunchableItem>());
            outcome.Item.Should().BeSameAs(two, "the chain came back around to where it started");
        }

        [Fact]
        public async Task Given_ARestoredRandomStreamWhoseEveryPickIsIncompatible_When_NextAsync_Then_ItGivesUpWithTheIncompatibleOutcome()
        {
            var bad = Listed<SongItem>("/music/bad.sid");
            _launchService
                .LaunchRandom(Any<TeensyStorageType>(), Any<StorageScope>(), Any<string>(), Any<TeensyFilterType>())
                .Returns(_ => Outcome(LaunchStatus.Incompatible, bad, "That SID needs more RAM."));
            var player = Restored(Record(current: "/music/1.sid", mode: PlayMode.Random));

            var outcome = await player.NextAsync();

            outcome!.Status.Should().Be(LaunchStatus.Incompatible);
            var picks = _launchService.ReceivedCalls().Count(call => call.GetMethodInfo().Name == nameof(ILaunchService.LaunchRandom));
            picks.Should().BeInRange(2, 1000, "it tried again, then stopped");
        }
    }
}
