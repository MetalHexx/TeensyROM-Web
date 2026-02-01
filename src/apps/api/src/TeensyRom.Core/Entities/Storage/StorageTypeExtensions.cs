namespace TeensyRom.Core.Entities.Storage
{
    public static class TeensyFileTypeExtensions
    {
        public static TeensyFileType[] GetLaunchFileTypes()
        {
            return Enum.GetValues(typeof(TeensyFileType))
                .Cast<TeensyFileType>()
                .Where(f => f != TeensyFileType.Hex && f != TeensyFileType.Unknown)
                .ToArray();
        }
    }
    public static class StorageFileExtensions
    {
        public static FileItem ToFileItem(this FileTransferItem transferItem)
        {
            var fileName = transferItem.TargetPath.FileName;

            return transferItem.Type switch
            {
                TeensyFileType.Sid => new SongItem  { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Crt => new GameItem  { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Prg => new GameItem  { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.P00 => new GameItem  { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Hex => new HexItem   { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Kla => new ImageItem { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Koa => new ImageItem { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Art => new ImageItem { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Aas => new ImageItem { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Hpi => new ImageItem { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Seq => new ImageItem { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                TeensyFileType.Txt => new ImageItem { Name = fileName, Title = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
                
                _ => new FileItem { Name = fileName, Path = transferItem.TargetPath, Size = transferItem.Size, StorageType = transferItem.TargetStorage },
            };
        }

        public static FileItem MapFileItem(this FileItem fileItem)
        {
            return fileItem.FileType switch
            {
                TeensyFileType.Sid => new SongItem  { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Crt => new GameItem  { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Prg => new GameItem  { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.P00 => new GameItem  { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Hex => new HexItem   { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Kla => new ImageItem { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Koa => new ImageItem { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Art => new ImageItem { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Aas => new ImageItem { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Hpi => new ImageItem { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Seq => new ImageItem { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                TeensyFileType.Txt => new ImageItem { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
                _ =>                  new FileItem  { Name = fileItem.Name, Title = fileItem.Name, Path = fileItem.Path, Size = fileItem.Size, StorageType = fileItem.StorageType },
            };
        }
    }
    public static class StorageTypeExtensions
    {
        public static uint GetStorageToken(this TeensyStorageType type)
        {
            return type switch
            {
                TeensyStorageType.SD => TeensyStorageToken.SdCard,
                TeensyStorageType.USB => TeensyStorageToken.UsbStick,
                _ => throw new ArgumentException("Unknown Storage Type")
            };
        }

        public static TeensyFileType GetFileType(this string extension) => extension.ToLower() switch
        {
            ".sid" => TeensyFileType.Sid,
            ".crt" => TeensyFileType.Crt,
            ".prg" => TeensyFileType.Prg,
            ".p00" => TeensyFileType.P00,
            ".hex" => TeensyFileType.Hex,
            ".kla" => TeensyFileType.Kla,
            ".koa" => TeensyFileType.Koa,
            ".art" => TeensyFileType.Art,
            ".aas" => TeensyFileType.Aas,
            ".hpi" => TeensyFileType.Hpi,
            ".seq" => TeensyFileType.Seq,
            ".txt" => TeensyFileType.Txt,
            ".d64" => TeensyFileType.D64,
            ".zip" => TeensyFileType.Zip,
            _ => TeensyFileType.Unknown
        };
    }
}
