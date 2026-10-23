using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Storage.Services
{
    public interface ILaunchHistory
    {
        void Add(ILaunchableItem fileItem);
        void Clear();
        void ClearForwardHistory();
        ILaunchableItem? GetNext(params TeensyFileType[] types);
        ILaunchableItem? GetPrevious(params TeensyFileType[] types);
        bool CurrentIsNew { get; }
        void Remove(ILaunchableItem fileItem);

        /// <summary>The entries in the order they were added.</summary>
        IReadOnlyList<ILaunchableItem> Items { get; }

        /// <summary>The position <see cref="GetPrevious"/> and <see cref="GetNext"/> walk from; -1 when the history is empty.</summary>
        int CurrentIndex { get; }

        /// <summary>Replaces the history with <paramref name="items"/>, standing at <paramref name="currentIndex"/> (kept within the list).</summary>
        void Restore(IEnumerable<ILaunchableItem> items, int currentIndex);
    }
}