using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;

namespace TeensyRom.Core.Storage
{
    public class StorageFactory(IMediator mediator, IGameMetadataService gameMetadata, ISidMetadataService sidMetadata, ILoggingService log) : IStorageFactory
    {
        public IStorageService Create(CartStorage cartStorage, ICommunicationPort communicationPort)
        {
            var settings = new StorageSettings
            {
                CartStorage = cartStorage,
            };
            var storageCache = new SimpleStorageCache(cartStorage, settings);
            var storageService = new StorageService(storageCache, settings, mediator, log, sidMetadata, gameMetadata, communicationPort);
            return storageService;
        }
    }
}
