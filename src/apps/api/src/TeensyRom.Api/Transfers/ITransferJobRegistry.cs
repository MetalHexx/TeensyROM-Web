using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// In-memory registry of transfer jobs. No persistence — jobs live for the lifetime of the process.
    /// </summary>
    public interface ITransferJobRegistry
    {
        TransferJob Create(string deviceId, TeensyStorageType storageType, DirectoryPath destination);
        TransferJob? Get(string jobId);
        TransferJob? GetActive(string deviceId);
        IReadOnlyCollection<TransferJob> All();
        void Remove(string jobId);
    }
}
