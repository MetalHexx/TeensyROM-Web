namespace TeensyRom.Core.Common
{
    public class TeensyException: Exception
    {
        public TeensyException(string message) : base(message) { }
        public TeensyException(string message, Exception ex) : base(message, ex) { }
    }

    public class TeensyDjException() : TeensyException(string.Empty) { }
    public class TeensyBusyException(string message) : TeensyException(message) { }
    /// <summary>A link failure the gate has already recovered from or given up on; its message is the user-facing one and is never recovered again.</summary>
    public class TeensyLinkException(string message) : TeensyException(message) { }
    public class TeensyDuplicateException(string message) : TeensyException(message) { }
    /// <summary>
    /// A serial write the device never drained. A <see cref="TimeoutException"/> on purpose: the command pipeline
    /// already treats one as a link failure and recovers the port, and the transfer handler does not retry it.
    /// </summary>
    public class TeensyWriteTimeoutException(string message, Exception inner) : TimeoutException(message, inner) { }

    public class TeensyStateException(string message) : Exception(message) { }
}
