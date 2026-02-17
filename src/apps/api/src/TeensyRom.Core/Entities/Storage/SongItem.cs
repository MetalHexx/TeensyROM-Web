namespace TeensyRom.Core.Entities.Storage
{
    public class SongItem : LaunchableItem, IViewableItem
    {
        private string _creator = string.Empty;
        private string _description = string.Empty;

        public override string Creator
        {
            get => string.IsNullOrWhiteSpace(_creator) ? GetExtensionShortDescription() : _creator;
            set => _creator = value;
        }

        public override string Description
        {
            get => string.IsNullOrWhiteSpace(_description) ? GetExtensionLongDescription() : _description;
            set => _description = value;
        }

        public override string Title => $"{Name[..Name.LastIndexOf('.')]}";
        public override string Meta1 => Name[(Name.LastIndexOf('.') + 1)..];
        public TimeSpan PlayLength { get; set; } = TimeSpan.FromMinutes(3);
        public List<TimeSpan> SubtuneLengths { get; set; } = [];
        public int StartSubtuneNum { get; set; }
        public string SongCsdbUrl { get; set; } = string.Empty;
        public List<ViewableItemImage> Images { get; init; } = [];

        public bool IsPlaylistedOrFavorite => Path.Value.Contains(StorageHelper.Playlist_Path) || Path.ToString().Contains(StorageHelper.Favorites_Path);

        private string GetExtensionShortDescription()
        {
            return FileType switch
            {
                TeensyFileType.Sid => "SID Music File",
                _ => "Unknown File Type"
            };
        }

        private string GetExtensionLongDescription()
        {
            return FileType switch
            {
                TeensyFileType.Sid => "About SID Files:\r\rThe SID (Sound Interface Device) format is synonymous with Commodore 64 music. These files contain compositions created using the legendary SID chip (MOS 6581/8580), known for its distinctive analog sound. SID files preserve not just the music data but also the code necessary to play it, making them a perfect time capsule of C64 audio artistry. They remain popular in the demoscene and retro gaming communities, celebrated for their technical ingenuity and nostalgic charm.",
                _ => "Unknown File Type"
            };
        }

        public override SongItem Clone() => new()
        {
            Name = Name,
            Path = Path,
            Size = Size,
            IsFavorite = IsFavorite,
            Creator = _creator,
            Description = _description,
            ReleaseInfo = ReleaseInfo,
            ShareUrl = ShareUrl,
            MetadataSource = MetadataSource,
            Meta2 = Meta2,
            MetadataSourcePath = MetadataSourcePath,
            StorageType = StorageType,
            PlayLength = PlayLength,
            SubtuneLengths = SubtuneLengths,
            StartSubtuneNum = StartSubtuneNum,
            SongCsdbUrl = SongCsdbUrl,
            Images = Images.Select(x => x.Clone()).ToList(),
            Custom = Custom?.Clone()
        };
    }
}
