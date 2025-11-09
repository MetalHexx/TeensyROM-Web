namespace TeensyRom.Core.Common
{
    public class TeensyException: Exception
    {
        public TeensyException(string message) : base(message) { }
        public TeensyException(string message, Exception ex) : base(message, ex) { }
    }

    public class TeensyDjException() : TeensyException(string.Empty) { }
    public class TeensyBusyException(string message) : TeensyException(message) { }
    public class TeensyDuplicateException(string message) : TeensyException(message) { }

    public class TeensyStateException(string message) : Exception(message) { }
}
