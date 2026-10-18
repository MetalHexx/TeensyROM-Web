using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using System.Reflection;
using System.Reactive;

namespace TeensyRom.Core.Storage
{
    public class SimpleStorageCache : BaseStorageCache
    {
        private string _cacheFilePath = string.Empty;
        private readonly StorageSettings _settings;
        
        protected override string CacheFilePath => _cacheFilePath;
        protected override BanLists Bans => _settings.GetBans();

        public SimpleStorageCache(CartStorage cartStorage, StorageSettings settings) 
        {
            _settings = settings;
            if(cartStorage.Type == TeensyStorageType.SD)
            {
                _cacheFilePath = Path.Combine(
                    Assembly.GetExecutingAssembly().GetDataPath(),
                    StorageHelper.Cache_File_Relative_Path,
                    $"{StorageHelper.Sd_Cache_File_Name}{cartStorage.DeviceId}{StorageHelper.Cache_File_Extension}");
            }
            else
            {
                _cacheFilePath = Path.Combine(
                    Assembly.GetExecutingAssembly().GetDataPath(),
                    StorageHelper.Cache_File_Relative_Path,
                    $"{StorageHelper.Usb_Cache_File_Name}{cartStorage.DeviceId}{StorageHelper.Cache_File_Extension}");
            }
            ReadFromDisk();
            _storageReady.OnNext(Unit.Default);
        }
    }
}
