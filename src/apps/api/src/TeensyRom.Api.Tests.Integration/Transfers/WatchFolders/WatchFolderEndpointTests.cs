using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Endpoints.WatchFolders.AddWatchFolder;
using TeensyRom.Api.Endpoints.WatchFolders.GetWatchFolders;
using TeensyRom.Api.Endpoints.WatchFolders.RemoveWatchFolder;
using TeensyRom.Api.Endpoints.WatchFolders.RemoveWatchFolderDevice;
using TeensyRom.Api.Endpoints.WatchFolders.SetWatchFolderEnabled;
using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Tests.Integration.Transfers.WatchFolders
{
    /// <summary>
    /// The watch-folder endpoints over HTTP against the fixture's fake devices (each with SD and USB).
    /// Folders are temp directories, and every folder a test leaves behind is removed afterwards.
    /// </summary>
    [Collection("Transfer")]
    public class WatchFolderEndpointTests(TransferFixture f) : IAsyncLifetime
    {
        private readonly List<string> _tempDirs = [];

        private string DeviceA => f.DeviceManager.Devices[0].DeviceId;
        private string DeviceB => f.DeviceManager.Devices[1].DeviceId;

        public Task InitializeAsync() => Task.CompletedTask;

        public async Task DisposeAsync()
        {
            var store = f.Services.GetRequiredService<IWatchFolderStore>();
            foreach (var folder in store.GetAll()) store.RemoveFolder(folder.Id);

            // The engine's watcher stops watching a removed folder on its own loop; its directory is deleted only after that.
            var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(10);
            while (f.WatchFactory.ActiveWatchCount > 0 && DateTime.UtcNow < deadline) await Task.Delay(10);

            foreach (var dir in _tempDirs.Where(Directory.Exists)) Directory.Delete(dir, recursive: true);
        }

        private string NewFolder()
        {
            var dir = Directory.CreateTempSubdirectory("teensyrom-watch-folder-it-").FullName;
            _tempDirs.Add(dir);
            return dir;
        }

        private Task<RadTestResult<TResponse>> AddAsync<TResponse>(
            string path, string deviceId, TeensyStorageType storage = TeensyStorageType.SD, string? devicePath = null) =>
            f.Client.PostAsync<AddWatchFolderEndpoint, AddWatchFolderRequest, TResponse>(new()
            {
                Body = new AddWatchFolderBody { Path = path, DeviceId = deviceId, StorageType = storage, DevicePath = devicePath, Launch = true }
            });

        [Fact]
        public async Task AddListToggleRemove_RoundTrips()
        {
            var path = NewFolder();

            var added = await AddAsync<AddWatchFolderResponse>(path, DeviceA, devicePath: "/music");
            added.Should().BeSuccessful<AddWatchFolderResponse>().WithStatusCode(HttpStatusCode.OK);
            added.Content.Created.Should().BeTrue();
            var folder = added.Content.WatchFolder;
            folder.Enabled.Should().BeTrue();
            folder.State.Should().Be(WatchFolderState.Watching);
            var destination = folder.Destinations.Should().ContainSingle().Subject;
            destination.DeviceId.Should().Be(DeviceA);
            destination.DeviceName.Should().NotBeNullOrEmpty();
            destination.Path.Should().Be("/music/");

            var listed = await f.Client.GetAsync<GetWatchFoldersEndpoint, GetWatchFoldersResponse>();
            listed.Content.WatchFolders.Should().ContainSingle().Which.Id.Should().Be(folder.Id);

            var disabled = await f.Client.PutAsync<SetWatchFolderEnabledEndpoint, SetWatchFolderEnabledRequest, SetWatchFolderEnabledResponse>(new()
            {
                WatchFolderId = folder.Id,
                Body = new SetWatchFolderEnabledBody { Enabled = false }
            });
            disabled.Should().BeSuccessful<SetWatchFolderEnabledResponse>().WithStatusCode(HttpStatusCode.OK);
            disabled.Content.WatchFolder.Enabled.Should().BeFalse();
            disabled.Content.WatchFolder.State.Should().Be(WatchFolderState.Off);

            var removed = await f.Client.DeleteAsync<RemoveWatchFolderEndpoint, RemoveWatchFolderRequest, RemoveWatchFolderResponse>(new() { WatchFolderId = folder.Id });
            removed.Should().BeSuccessful<RemoveWatchFolderResponse>().WithStatusCode(HttpStatusCode.OK);

            (await f.Client.GetAsync<GetWatchFoldersEndpoint, GetWatchFoldersResponse>()).Content.WatchFolders.Should().BeEmpty();
            Directory.Exists(path).Should().BeTrue();
        }

        [Fact]
        public async Task Add_SameFolderForAnotherDevice_AddsADestination_AndRemovingTheLastOneRemovesTheFolder()
        {
            var path = NewFolder();
            var first = await AddAsync<AddWatchFolderResponse>(path, DeviceA);
            var second = await AddAsync<AddWatchFolderResponse>(path, DeviceB, TeensyStorageType.USB);

            second.Should().BeSuccessful<AddWatchFolderResponse>().WithStatusCode(HttpStatusCode.OK);
            second.Content.Created.Should().BeFalse();
            second.Content.WatchFolder.Id.Should().Be(first.Content.WatchFolder.Id);
            second.Content.WatchFolder.Destinations.Should().HaveCount(2);

            var id = second.Content.WatchFolder.Id;
            var removeFirst = await f.Client.DeleteAsync<RemoveWatchFolderDeviceEndpoint, RemoveWatchFolderDeviceRequest, RemoveWatchFolderDeviceResponse>(
                new() { WatchFolderId = id, DeviceId = DeviceA });
            removeFirst.Content.FolderRemoved.Should().BeFalse();
            removeFirst.Content.WatchFolder!.Destinations.Should().ContainSingle().Which.DeviceId.Should().Be(DeviceB);

            var removeLast = await f.Client.DeleteAsync<RemoveWatchFolderDeviceEndpoint, RemoveWatchFolderDeviceRequest, RemoveWatchFolderDeviceResponse>(
                new() { WatchFolderId = id, DeviceId = DeviceB });
            removeLast.Content.FolderRemoved.Should().BeTrue();
            removeLast.Content.WatchFolder.Should().BeNull();
            (await f.Client.GetAsync<GetWatchFoldersEndpoint, GetWatchFoldersResponse>()).Content.WatchFolders.Should().BeEmpty();
        }

        [Fact]
        public async Task Add_SecondDestinationForADeviceAlreadyOnTheFolder_Is409()
        {
            var path = NewFolder();
            await AddAsync<AddWatchFolderResponse>(path, DeviceA, TeensyStorageType.SD);

            var again = await AddAsync<ProblemDetails>(path, DeviceA, TeensyStorageType.USB);

            again.Should().BeProblem().WithStatusCode(HttpStatusCode.Conflict);
        }

        [Fact]
        public async Task Add_FolderNestedInAWatchedFolder_Is400()
        {
            var path = NewFolder();
            await AddAsync<AddWatchFolderResponse>(path, DeviceA);
            var child = Directory.CreateDirectory(Path.Combine(path, "child")).FullName;

            var nested = await AddAsync<ProblemDetails>(child, DeviceB);

            nested.Should().BeProblem().WithStatusCode(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Add_MissingFolder_Is400()
        {
            var missing = Path.Combine(NewFolder(), "nope");

            (await AddAsync<ProblemDetails>(missing, DeviceA)).Should().BeProblem().WithStatusCode(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Add_DeviceNotConnected_Is404()
        {
            (await AddAsync<string>(NewFolder(), "NOSUCHDEVICE")).Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task UnknownFolder_Is404ForRemoveRemoveDeviceAndToggle()
        {
            var remove = await f.Client.DeleteAsync<RemoveWatchFolderEndpoint, RemoveWatchFolderRequest, string>(new() { WatchFolderId = "missing" });
            var removeDevice = await f.Client.DeleteAsync<RemoveWatchFolderDeviceEndpoint, RemoveWatchFolderDeviceRequest, string>(
                new() { WatchFolderId = "missing", DeviceId = DeviceA });
            var toggle = await f.Client.PutAsync<SetWatchFolderEnabledEndpoint, SetWatchFolderEnabledRequest, string>(
                new() { WatchFolderId = "missing", Body = new SetWatchFolderEnabledBody { Enabled = true } });

            remove.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
            removeDevice.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
            toggle.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task RemoveDevice_DeviceNotOnTheFolder_Is404()
        {
            var added = await AddAsync<AddWatchFolderResponse>(NewFolder(), DeviceA);

            var result = await f.Client.DeleteAsync<RemoveWatchFolderDeviceEndpoint, RemoveWatchFolderDeviceRequest, string>(
                new() { WatchFolderId = added.Content.WatchFolder.Id, DeviceId = DeviceB });

            result.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }
}
