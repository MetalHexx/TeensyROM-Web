using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Endpoints.Transfers.ListJobs;
using TeensyRom.Api.Endpoints.Transfers.SealJob;
using TeensyRom.Api.Endpoints.WatchFolders.GetWatchFolders;
using TeensyRom.Api.Models;
using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Integration.Transfers.WatchFolders
{
    /// <summary>
    /// Files written into a real temp folder, watched by the engine's real watcher with millisecond-scale timing,
    /// arrive on the fake devices as transfer jobs. The arrival rules are covered by the unit tests; these prove
    /// the wiring end to end. Each wait polls with a bound; none sleeps for a fixed time.
    /// </summary>
    [Collection("Transfer")]
    public class WatchFolderArrivalTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

        private readonly List<string> _tempDirs = [];

        private IWatchFolderStore Store => f.Services.GetRequiredService<IWatchFolderStore>();
        private string DeviceA => f.DeviceManager.Devices[0].DeviceId;
        private string DeviceB => f.DeviceManager.Devices[1].DeviceId;

        public Task InitializeAsync() => Task.CompletedTask;

        public async Task DisposeAsync()
        {
            foreach (var folder in Store.GetAll()) Store.RemoveFolder(folder.Id);

            await WaitUntilAsync(() => f.WatchFactory.ActiveWatchCount == 0, "the watcher to stop every watch");
            await f.WaitForQuiescenceAsync();

            foreach (var dir in _tempDirs.Where(Directory.Exists)) Directory.Delete(dir, recursive: true);
        }

        private string NewDir()
        {
            var dir = Directory.CreateTempSubdirectory("teensyrom-watch-arrival-it-").FullName;
            _tempDirs.Add(dir);
            return dir;
        }

        /// <summary>Adds a destination to the folder, creating it when needed, and returns once the watcher is watching it.</summary>
        private async Task<WatchFolder> WatchAsync(string dir, string deviceId, string devicePath, TeensyStorageType storage = TeensyStorageType.SD)
        {
            var added = Store.Add(new WatchFolderAdd(dir, deviceId, storage, devicePath, Launch: false));
            added.Error.Should().BeNull(added.Message);

            var folder = added.Folder!;
            await WaitUntilAsync(() => f.WatchFactory.IsWatching(folder.Path), $"the watcher to watch {folder.Path}");
            return folder;
        }

        private async Task<List<TransferJobDto>> JobsFromAsync(WatchFolder folder)
        {
            var response = await f.Client.GetAsync<ListJobsEndpoint, ListJobsResponse>();
            return response.Content.Jobs.Where(j => j.Origin.WatchFolderId == folder.Id).ToList();
        }

        private async Task<List<TransferJobDto>> WaitForCompletedJobsAsync(WatchFolder folder, int count)
        {
            List<TransferJobDto> jobs = [];
            await WaitUntilAsync(async () =>
            {
                jobs = await JobsFromAsync(folder);
                return jobs.Count >= count && jobs.All(j => j.State == TransferJobState.Completed);
            }, $"{count} completed job(s) from {folder.Path}");

            return jobs;
        }

        private List<string> ReceivedBy(string deviceId, string devicePathPrefix) =>
            f.DeviceManager.PortFor(deviceId).Received
                .Select(r => r.Path)
                .Where(p => p.StartsWith(devicePathPrefix, StringComparison.Ordinal))
                .Order(StringComparer.Ordinal)
                .ToList();

        private static void Write(string path, int size = 64)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllBytes(path, new byte[size]);
        }

        [Fact]
        public async Task SidWrittenIntoAWatchedFolder_LandsOnTheDevice_AsAJobFromThatWatchFolder()
        {
            var dir = NewDir();
            var folder = await WatchAsync(dir, DeviceA, "/watch-it/sid");

            Write(Path.Combine(folder.Path, "tune.sid"));

            var job = (await WaitForCompletedJobsAsync(folder, 1)).Should().ContainSingle().Subject;
            job.Origin.Kind.Should().Be(TransferOriginKind.WatchFolder);
            job.Origin.WatchFolderPath.Should().Be(folder.Path);
            job.DeviceId.Should().Be(DeviceA);
            job.StorageType.Should().Be(TeensyStorageType.SD);
            ReceivedBy(DeviceA, "/watch-it/sid/").Should().Equal("/watch-it/sid/tune.sid");
        }

        [Fact]
        public async Task CopiedSubfolder_ArrivesAsOneJobWithItsLayout_AndNothingThatWasAlreadyThereIsSent()
        {
            var dir = NewDir();
            Write(Path.Combine(dir, "pack", "old.sid"));
            var folder = await WatchAsync(dir, DeviceA, "/watch-it/layout");

            var outside = NewDir();
            Write(Path.Combine(outside, "album", "one.sid"));
            Write(Path.Combine(outside, "album", "disc", "two.prg"));
            Write(Path.Combine(outside, "album", "disc", "three.txt"));
            Directory.Move(Path.Combine(outside, "album"), Path.Combine(folder.Path, "album"));

            var first = (await WaitForCompletedJobsAsync(folder, 1)).Should().ContainSingle().Subject;
            first.FilesSent.Should().Be(3);
            ReceivedBy(DeviceA, "/watch-it/layout/").Should().Equal(
                "/watch-it/layout/album/disc/three.txt", "/watch-it/layout/album/disc/two.prg", "/watch-it/layout/album/one.sid");

            File.Move(Path.Combine(folder.Path, "pack", "old.sid"), Path.Combine(folder.Path, "pack", "renamed.sid"));
            Write(Path.Combine(folder.Path, "pack", "new.sid"));
            Write(Path.Combine(folder.Path, "readme.doc"));

            var jobs = await WaitForCompletedJobsAsync(folder, 2);
            jobs.Should().HaveCount(2);
            ReceivedBy(DeviceA, "/watch-it/layout/").Should().Contain("/watch-it/layout/pack/new.sid")
                .And.NotContain(p => p.Contains("old.sid") || p.Contains("renamed.sid") || p.EndsWith(".doc"));
            f.Log.Lines.Should().NotContain(l => l.Message.Contains("readme.doc"));
        }

        [Fact]
        public async Task PartialDownloadRenamedToItsFinalName_IsSentOnce()
        {
            var dir = NewDir();
            var folder = await WatchAsync(dir, DeviceA, "/watch-it/partial");

            Write(Path.Combine(folder.Path, "notes.txt.crdownload"));
            File.Move(Path.Combine(folder.Path, "notes.txt.crdownload"), Path.Combine(folder.Path, "notes.txt"));

            await WaitForCompletedJobsAsync(folder, 1);
            ReceivedBy(DeviceA, "/watch-it/partial/").Should().Equal("/watch-it/partial/notes.txt");
        }

        [Fact]
        public async Task TwoDestinations_OneDeviceBusyWithAnotherJob_LogsOnceAndTheOtherDestinationStillRuns()
        {
            var dir = NewDir();
            await WatchAsync(dir, DeviceA, "/watch-it/busy-a");
            var folder = await WatchAsync(dir, DeviceB, "/watch-it/busy-b", TeensyStorageType.USB);

            var dragAndDrop = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(new()
            {
                DeviceId = DeviceA,
                StorageType = TeensyStorageType.SD,
                Body = new CreateJobBody { DestinationDirectory = "/watch-it/drag" }
            });

            try
            {
                Write(Path.Combine(folder.Path, "tune.sid"));

                var job = (await WaitForCompletedJobsAsync(folder, 1)).Should().ContainSingle().Subject;
                job.DeviceId.Should().Be(DeviceB);
                ReceivedBy(DeviceB, "/watch-it/busy-b/").Should().Equal("/watch-it/busy-b/tune.sid");
                ReceivedBy(DeviceA, "/watch-it/busy-a/").Should().BeEmpty();

                f.Log.Lines.Should().ContainSingle(l =>
                    l.Level == nameof(ILoggingService.InternalWarning)
                    && l.DeviceId == DeviceA
                    && l.Message.Contains("already transferring"));
            }
            finally
            {
                await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = dragAndDrop.Content.JobId });
            }
        }

        [Fact]
        public async Task DisabledFolder_SendsNothing_AndTurningItBackOnSendsOnlyLaterArrivals()
        {
            var dir = NewDir();
            var folder = await WatchAsync(dir, DeviceA, "/watch-it/toggle");

            Store.SetEnabled(folder.Id, false);
            await WaitUntilAsync(() => !f.WatchFactory.IsWatching(folder.Path), "the watch to stop");
            Write(Path.Combine(folder.Path, "while-off.sid"));

            Store.SetEnabled(folder.Id, true);
            await WaitUntilAsync(() => f.WatchFactory.IsWatching(folder.Path), "the watch to start again");
            Write(Path.Combine(folder.Path, "after-on.sid"));

            await WaitForCompletedJobsAsync(folder, 1);
            ReceivedBy(DeviceA, "/watch-it/toggle/").Should().Equal("/watch-it/toggle/after-on.sid");
        }

        [Fact]
        public async Task DeletedFolder_IsUnavailable_AndWatchingResumesWhenItIsRecreated()
        {
            var dir = NewDir();
            var folder = await WatchAsync(dir, DeviceA, "/watch-it/gone");

            Directory.Delete(folder.Path, recursive: true);

            await WaitUntilAsync(async () => await StateAsync(folder) == WatchFolderState.Unavailable, "the folder to read as unavailable");
            await WaitUntilAsync(() => !f.WatchFactory.IsWatching(folder.Path), "the watcher to drop the deleted folder");

            await WaitUntilAsync(() =>
            {
                try
                {
                    Directory.CreateDirectory(folder.Path);
                    return true;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    return false;
                }
            }, "the folder to be recreated");

            await WaitUntilAsync(() => f.WatchFactory.IsWatching(folder.Path), "watching to resume");
            (await StateAsync(folder)).Should().Be(WatchFolderState.Watching);

            Write(Path.Combine(folder.Path, "back.sid"));

            await WaitForCompletedJobsAsync(folder, 1);
            ReceivedBy(DeviceA, "/watch-it/gone/").Should().Equal("/watch-it/gone/back.sid");
        }

        private async Task<WatchFolderState> StateAsync(WatchFolder folder)
        {
            var listed = await f.Client.GetAsync<GetWatchFoldersEndpoint, GetWatchFoldersResponse>();
            return listed.Content.WatchFolders.Single(w => w.Id == folder.Id).State;
        }

        private static Task WaitUntilAsync(Func<bool> condition, string waitingFor) =>
            WaitUntilAsync(() => Task.FromResult(condition()), waitingFor);

        private static async Task WaitUntilAsync(Func<Task<bool>> condition, string waitingFor)
        {
            var deadline = DateTime.UtcNow + Timeout;
            while (!await condition())
            {
                if (DateTime.UtcNow > deadline) throw new TimeoutException($"Timed out waiting for {waitingFor}.");
                await Task.Delay(25);
            }
        }
    }
}
