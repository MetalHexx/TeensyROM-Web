using System.Net.Http.Headers;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;

namespace TeensyRom.Api.Tests.Integration.Common
{
    /// <summary>
    /// A sibling of <see cref="EndpointFixture"/> for transfer tests: additionally bypasses hardware
    /// discovery via <see cref="FakeDeviceConnectionManager"/> and registers a <see cref="TransferOptions"/>
    /// backed by a fresh staging directory. Left as a separate fixture/collection so every existing
    /// <see cref="EndpointFixture"/>-based test is untouched.
    /// </summary>
    public class TransferFixture : IDisposable
    {
        private readonly WebApplicationFactory<Program> _factory;
        private readonly string _stagingRoot;

        public TrClient Client
        {
            get
            {
                var httpClient = _factory.CreateClient(new WebApplicationFactoryClientOptions
                {
                    AllowAutoRedirect = false
                });

                httpClient.Timeout = TimeSpan.FromMinutes(10);
                httpClient.DefaultRequestHeaders.CacheControl = new CacheControlHeaderValue
                {
                    NoCache = true,
                    NoStore = true,
                    MustRevalidate = true
                };

                return new TrClient(httpClient);
            }
        }

        /// <summary>Raw HttpClient for the eventual raw-body upload, which the typed endpoint helpers cannot express.</summary>
        public HttpClient RawClient
        {
            get
            {
                var httpClient = _factory.CreateClient(new WebApplicationFactoryClientOptions
                {
                    AllowAutoRedirect = false
                });

                httpClient.Timeout = TimeSpan.FromMinutes(10);
                return httpClient;
            }
        }

        public IServiceProvider Services => _factory.Services;

        public FakeDeviceConnectionManager DeviceManager { get; }

        public TransferOptions Options { get; }

        public int MaxStagedFiles
        {
            get => Options.MaxStagedFiles;
            set => Options.MaxStagedFiles = value;
        }

        public TimeSpan IdleAbandonmentThreshold
        {
            get => Options.IdleAbandonmentThreshold;
            set => Options.IdleAbandonmentThreshold = value;
        }

        public TimeSpan SweepInterval
        {
            get => Options.SweepInterval;
            set => Options.SweepInterval = value;
        }

        public TransferFixture() : this(null)
        {
        }

        /// <summary>
        /// Lets a derived fixture tune <see cref="TransferOptions"/> - or seed the staging directory -
        /// before the host builds. The only window in which a value baked into a singleton at
        /// construction time (the capacity gate's file semaphore, the staging root's initial contents)
        /// can differ from this class's defaults; every collection fixture is constructed with no
        /// arguments, so a suite that needs different tuning derives its own fixture and collection
        /// instead of mutating <see cref="Options"/> on a host that already started.
        /// </summary>
        protected TransferFixture(Action<TransferOptions>? configureOptions)
        {
            _stagingRoot = Directory.CreateTempSubdirectory("teensyrom-transfer-tests-").FullName;
            Options = new TransferOptions { StagingRoot = _stagingRoot };
            configureOptions?.Invoke(Options);

            _factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.ConfigureServices(services =>
                    {
                        // Same idiom as EndpointFixture: disable auto-connect so the bootstrap hosted
                        // service doesn't try to auto-connect a device on startup.
                        var settingsServiceDescriptor = services.FirstOrDefault(d => d.ServiceType == typeof(SettingsService));
                        if (settingsServiceDescriptor != null)
                        {
                            services.Remove(settingsServiceDescriptor);
                        }
                        var iSettingsServiceDescriptor = services.FirstOrDefault(d => d.ServiceType == typeof(ISettingsService));
                        if (iSettingsServiceDescriptor != null)
                        {
                            services.Remove(iSettingsServiceDescriptor);
                        }
                        services.AddSingleton<SettingsService, TestSettingsService>();
                        services.AddSingleton<ISettingsService>(sp => sp.GetRequiredService<SettingsService>());

                        // Bypass hardware discovery entirely - FindDevicesEndpoint and anything else
                        // built on IDeviceConnectionManager gets the fixed fake devices instead.
                        var deviceManagerDescriptor = services.FirstOrDefault(d => d.ServiceType == typeof(IDeviceConnectionManager));
                        if (deviceManagerDescriptor != null)
                        {
                            services.Remove(deviceManagerDescriptor);
                        }
                        services.AddSingleton<IDeviceConnectionManager>(sp =>
                            new FakeDeviceConnectionManager(sp.GetRequiredService<IStorageFactory>()));

                        services.AddSingleton(Options);
                    });
                });

            DeviceManager = (FakeDeviceConnectionManager)_factory.Services.GetRequiredService<IDeviceConnectionManager>();
        }

        public void Dispose()
        {
            _factory.Dispose();

            if (Directory.Exists(_stagingRoot))
            {
                Directory.Delete(_stagingRoot, recursive: true);
            }
        }
    }
}
