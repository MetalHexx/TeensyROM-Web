using TeensyRom.Tools.StorageBenchmark;

namespace TeensyRom.Core.Storage.Tests
{
    public class TimingStatisticsTests
    {
        [Fact]
        public void ComputeExcludingWarmup_DiscardsFirstSample()
        {
            // Arrange - the warm-up sample is a huge outlier that must not influence the statistics.
            var samplesMs = new List<double> { 10_000, 2, 4, 6 };

            // Act
            var (median, min, max) = TimingStatistics.ComputeExcludingWarmup(samplesMs);

            // Assert
            median.Should().Be(4);
            min.Should().Be(2);
            max.Should().Be(6);
        }

        [Theory]
        [InlineData(new double[] { 0, 1, 2, 3, 4 }, 2.5, 1, 4)]
        [InlineData(new double[] { 0, 1, 2, 3 }, 2, 1, 3)]
        [InlineData(new double[] { 0, 5 }, 5, 5, 5)]
        public void ComputeExcludingWarmup_ComputesMedianMinMax_FromKnownSequence(
            double[] samplesMs, double expectedMedian, double expectedMin, double expectedMax)
        {
            // Act
            var (median, min, max) = TimingStatistics.ComputeExcludingWarmup(samplesMs);

            // Assert
            median.Should().Be(expectedMedian);
            min.Should().Be(expectedMin);
            max.Should().Be(expectedMax);
        }

        [Fact]
        public void ComputeExcludingWarmup_IsOrderIndependent_WithinMeasuredSamples()
        {
            // Arrange
            var inOrder = new List<double> { 0, 1, 2, 3, 4 };
            var shuffled = new List<double> { 0, 4, 1, 3, 2 };

            // Act
            var expected = TimingStatistics.ComputeExcludingWarmup(inOrder);
            var actual = TimingStatistics.ComputeExcludingWarmup(shuffled);

            // Assert
            actual.Should().Be(expected);
        }

        [Fact]
        public void ComputeExcludingWarmup_Throws_WhenNoMeasuredSamplesRemain()
        {
            // Arrange
            var onlyWarmup = new List<double> { 5 };

            // Act
            Action act = () => TimingStatistics.ComputeExcludingWarmup(onlyWarmup);

            // Assert
            act.Should().Throw<ArgumentException>();
        }
    }
}
