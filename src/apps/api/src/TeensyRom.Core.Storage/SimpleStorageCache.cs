using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using System.Reflection;
using System.Reactive;

namespace TeensyRom.Core.Storage
{
    public class SimpleStorageCache : BaseStorageCache
    {
        private string _cacheFilePath = string.Empty;
        private List<string> _bannedDirectories = [];
        private List<string> _bannedFiles = [];
        
        protected override string CacheFilePath => _cacheFilePath;
        protected override List<string> BannedFiles => _bannedFiles;
        protected override List<string> BannedDirectories => _bannedDirectories;

        public SimpleStorageCache(CartStorage cartStorage, StorageSettings settings) 
        {
            if(cartStorage.Type == TeensyStorageType.SD)
            {
                _cacheFilePath = Path.Combine(
                    Assembly.GetExecutingAssembly().GetPath(),
                    StorageHelper.Cache_File_Relative_Path,
                    $"{StorageHelper.Sd_Cache_File_Name}{cartStorage.DeviceId}{StorageHelper.Cache_File_Extension}");
            }
            else
            {
                _cacheFilePath = Path.Combine(
                    Assembly.GetExecutingAssembly().GetPath(),
                    StorageHelper.Cache_File_Relative_Path,
                    $"{StorageHelper.Usb_Cache_File_Name}{cartStorage.DeviceId}{StorageHelper.Cache_File_Extension}");
            }
            _bannedDirectories = settings.BannedDirectories;
            _bannedFiles = settings.BannedFiles;
            ReadFromDisk();
            _storageReady.OnNext(Unit.Default);
        }
    }
}
