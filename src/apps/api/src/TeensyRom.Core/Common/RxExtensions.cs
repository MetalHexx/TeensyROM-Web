using System.Reactive.Linq;

namespace TeensyRom.Core.Common
{
    /// <summary>
    /// Extension methods for System.Reactive observables.
    /// </summary>
    public static class RxExtensions
    {
        /// <summary>
        /// Returns an observable sequence that only emits when the list content changes,
        /// using structural equality comparison for list elements (ideal for record types).
        /// </summary>
        /// <typeparam name="T">The type of elements in the list (should have value-based equality).</typeparam>
        /// <param name="source">The source observable sequence of lists.</param>
        /// <returns>An observable sequence that emits only when list content actually changes.</returns>
        public static IObservable<List<T>> DistinctUntilListChanged<T>(this IObservable<List<T>> source)
        {
            return source.DistinctUntilChanged(EqualityComparer<List<T>>.Create(
                equals: (x, y) => (x == null && y == null) || (x != null && y != null && x.SequenceEqual(y)),
                getHashCode: obj => obj?.Count ?? 0));
        }
    }
}
