using TeensyRom.Api.Services;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Device;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Games;
using TeensyRom.Core.Storage;
using TeensyRom.Core.Serial;
using TeensyRom.Api.Endpoints.Serial.GetLogs;
using TeensyRom.Core.Music;
using TeensyRom.Core.Music.Hvsc;
using TeensyRom.Core.Music.DeepSid;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Api.Startup
{
    public static class ServiceStartupExtensions
    {
        /// <summary>
        /// Registers TeensyROM application services as singletons.
        /// </summary>
        public static IServiceCollection AddTeensyRomServices(this IServiceCollection services)
        {
            services.AddSingleton<LoggingService>();
            services.AddSingleton<ILoggingService>(sp => sp.GetRequiredService<LoggingService>());
            services.AddSingleton<IQueuedChannelLogger>(sp => sp.GetRequiredService<LoggingService>());
            services.AddSingleton<ILogStream, LogStream>();
            services.AddSingleton<IAlertService, AlertService>();
            services.AddSingleton<SettingsService>();
            services.AddSingleton<ISettingsService>(sp => sp.GetRequiredService<SettingsService>());
            services.AddSingleton<IDeviceSettingsProvider>(sp => sp.GetRequiredService<SettingsService>());
            services.AddSingleton<IPlayerSettingsProvider>(sp => sp.GetRequiredService<SettingsService>());
            services.AddSingleton<IFileTransferSettingsProvider>(sp => sp.GetRequiredService<SettingsService>());
            services.AddSingleton<ISearchSettingsProvider>(sp => sp.GetRequiredService<SettingsService>());
            services.AddSingleton<IAppSettingsProvider>(sp => sp.GetRequiredService<SettingsService>());
            services.AddSingleton<IFwVersionChecker, FwVersionChecker>();
            services.AddSingleton<ICartFinder, CartFinder>();
            services.AddSingleton<ICartTagger, CartTagger>();
            services.AddSingleton<IDeviceConnectionManager, DeviceConnectionManager>();
            services.AddSingleton<IDeviceTransportFactory, DeviceTransportFactory>();
            services.AddSingleton<IStorageFactory, StorageFactory>();
            services.AddSingleton<IDiscoveryStrategy, SerialDiscoveryStrategy>();
            services.AddSingleton<IDiscoveryStrategy, TcpDiscoveryStrategy>();
            services.AddSingleton<IReconnectionStrategy, SerialReconnectionStrategy>();
            services.AddSingleton<IReconnectionStrategy, TcpReconnectionStrategy>();
            services.AddSingleton<IGameMetadataService, GameMetadataService>();
            services.AddSingleton<IHvscDatabase, HvscDatabase>();
            services.AddSingleton<IDeepSidDatabase, DeepSidDatabase>();
            services.AddSingleton<ISidMetadataService, SidMetadataService>();

            // Register application bootstrap hosted service
            services.AddHostedService<ApplicationBootstrapService>();

            return services;
        }
    }
}
