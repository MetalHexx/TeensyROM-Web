using CsvHelper.Configuration.Attributes;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO.Ports;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using System.Runtime.CompilerServices;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.State;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;

namespace TeensyRom.Core.Device
{
    public record DeviceStateSubscription(string DeviceId, IDisposable EventSubscription);

    public class DeviceConnectionManager : IDeviceConnectionManager
    {
        public IObservable<DeviceStateChange?> DeviceStateChanges => _deviceStates.AsObservable();

        private ConcurrentDictionary<string, TeensyRomDevice> _connectedDevices = [];
        private ConcurrentDictionary<string, TeensyRomDevice> _disconnectedDevices = [];
        private BehaviorSubject<DeviceStateChange?> _deviceStates = new(null);

        private readonly ICartFinder _finder;
        private readonly ILoggingService _log;
        private readonly IReconnectionStrategy _serialReconnection;
        private readonly IReconnectionStrategy _tcpReconnection;
        private bool _healthCheckEnabled = false;

        private readonly List<DeviceStateSubscription> _deviceEventSubscriptions = [];

        public DeviceConnectionManager(
            ICartFinder finder,
            ILoggingService log,
            IEnumerable<IReconnectionStrategy> reconnectionStrategies)
        {
            _finder = finder;
            _log = log;
            _serialReconnection = reconnectionStrategies.OfType<SerialReconnectionStrategy>().Single();
            _tcpReconnection = reconnectionStrategies.OfType<TcpReconnectionStrategy>().Single();
        }

        public List<TeensyRomDevice> GetConnectedDevices() => _connectedDevices.Select(d => d.Value).ToList();
        public TeensyRomDevice? GetConnectedDevice(string deviceId) => GetConnectedDevices().FirstOrDefault(d => d.DeviceId == deviceId);
        public TeensyRomDevice? GetDisconnectedDevice(string deviceId) => _disconnectedDevices.TryGetValue(deviceId, out var device) ? device : null;

        public void ClosePort(string deviceId)
        {
            if (_connectedDevices.TryRemove(deviceId, out var device))
            {
                device.SerialState.ClosePort();
                _disconnectedDevices.TryAdd(deviceId, device);
            }
        }

        public async Task<bool> ReconnectDevice(string deviceId)
        {
            var device = GetConnectedDevice(deviceId);

            if (device is null)
            {
                throw new TeensyException($"Device with ID {deviceId} not found in connected devices.");
            }

            // Select strategy based on ConnectionType
            var strategy = device.Cart.ConnectionType switch
            {
                ConnectionType.Serial => _serialReconnection,
                ConnectionType.Tcp => _tcpReconnection,
                _ => throw new ArgumentException($"Unknown connection type: {device.Cart.ConnectionType}")
            };

            return await strategy.TryReconnect(device, CancellationToken.None);
        }

        public async Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct)
        {
            _healthCheckEnabled = false;

            var devicesToReconnect = _connectedDevices.Select(d => d.Key).ToList();

            ClearEventSubcriptions();
            DisposeConnectedDevices();

            List<TeensyRomDevice> devices = [];

            try
            {
                devices = await _finder.FindDevices(ct);
                CreateEventSubscriptions(devices);
            }
            catch (OperationCanceledException)
            {
                _log.InternalError("The operation was cancelled while finding devices.");
                return [];
            }
            catch (Exception ex)
            {
                _log.ExternalError($"An error occurred while finding devices: {ex.Message}");
                return [];
            }

            _connectedDevices.Clear();
            _disconnectedDevices.Clear();

            if (!autoConnect)
            {
                var devicesToKeep = devices.Where(d => devicesToReconnect.Contains(d.DeviceId)).ToList();
                var devicesToDisconnect = devices.Where(d => !devicesToReconnect.Contains(d.DeviceId)).ToList();

                foreach (var device in devicesToDisconnect)
                {
                    device.SerialState.ClosePort();
                    _disconnectedDevices.TryAdd(device.DeviceId, device);
                }
                foreach (var device in devicesToKeep)
                {
                    var _ = _connectedDevices.TryAdd(device.DeviceId, device);
                }
                StartHealthCheck();
                return devices;
            }

            foreach (var device in devices)
            {
                if (!_connectedDevices.TryAdd(device.DeviceId, device))
                {
                    _log.InternalWarning($"Device with ID {device.DeviceId} already exists in the device list. Skipping duplicate.");
                    continue;
                }
            }

            StartHealthCheck();
            return devices;
        }

        private void CreateEventSubscriptions(List<TeensyRomDevice> devices)
        {
            devices.ForEach(d =>
            {
                var subscription = d.SerialState.CurrentState.Subscribe(state => _deviceStates.OnNext(new DeviceStateChange(d.DeviceId, state)));
                _deviceEventSubscriptions.Add(new DeviceStateSubscription(d.DeviceId, subscription));
            });
        }

        private void DisposeConnectedDevices()
        {
            foreach (var device in _connectedDevices.Values)
            {
                if (device.IsConnected)
                {
                    device.SerialState.ClosePort();
                }
                device.SerialState.Dispose();
            }
        }

        private void ClearEventSubcriptions()
        {
            foreach (var subscription in _deviceEventSubscriptions)
            {
                subscription.EventSubscription.Dispose();
            }
            _deviceEventSubscriptions.Clear();
        }

        public TeensyRomDevice? Connect(string deviceId)
        {
            var connectedDevice = GetConnectedDevice(deviceId);

            if (connectedDevice is not null) return connectedDevice;

            var device = GetDisconnectedDevice(deviceId);

            if (device is null) return null;

            device.SerialState.OpenPort();
            _disconnectedDevices.TryRemove(deviceId, out _);
            _connectedDevices.TryAdd(deviceId, device);

            return device;
        }

        private void StartHealthCheck()
        {
            _healthCheckEnabled = true;

            Task.Run(async () =>
            {
                List<TeensyRomDevice> _devicesToKill = [];

                while (_healthCheckEnabled)
                {
                    try
                    {
                        foreach (var device in _connectedDevices.Select(d => d.Value))
                        {
                            var currentState = await device.SerialState.CurrentState.FirstAsync();

                            if (currentState is SerialBusyState) continue;

                            if (device.IsConnected is true) continue;

                            if (!_healthCheckEnabled || device.IsConnected) return;

                            var result = await CheckDeviceHealth(device);

                            if (result is null)
                            {
                                _devicesToKill.Add(device);
                            }
                        }
                        _devicesToKill.ForEach(d =>
                        {
                            _log.InternalWarning($"Device {d.Cart.Name} - {d.DeviceId} @ {d.Cart.ConnectionDisplay} is no longer connected.  Removing from device list.");
                            _connectedDevices.TryRemove(d.DeviceId, out TeensyRomDevice? device);
                            device?.SerialState.Dispose();
                            var deviceSubscription = _deviceEventSubscriptions.FirstOrDefault(sub => sub.DeviceId == d.DeviceId);

                            if (deviceSubscription?.EventSubscription is not null)
                            {
                                deviceSubscription.EventSubscription.Dispose();
                                _deviceEventSubscriptions.Remove(deviceSubscription);
                            }
                        });
                        _devicesToKill.Clear();

                    }
                    catch (Exception ex)
                    {
                        _log.ExternalError($"Error in health check: {ex.Message}");
                    }
                    finally
                    {
                        await Task.Delay(SerialPortConstants.Health_Check_Milliseconds);
                    }
                }
            });
        }
        public void StopHealthCheck() => _healthCheckEnabled = false;

        private async Task<TeensyRomDevice?> CheckDeviceHealth(TeensyRomDevice device)
        {
            try
            {
                device.SerialState.EnsureConnection();

                var currentState = await device.SerialState.CurrentState.FirstAsync();

                if (currentState is SerialConnectionLostState)
                {
                    device.SerialState.TransitionTo(typeof(SerialConnectedState));
                }
            }
            catch (UnauthorizedAccessException)
            {
                _log.InternalError($"DeviceConnectionManager.CheckDeviceHealth: Unauthorized access to {device.Cart.Name} - {device.DeviceId} @ {device.Cart.ConnectionDisplay}.");
                _log.InternalError($"Please check if the port is already in use.");
                return null;
            }
            catch (Exception)
            {
                _log.ExternalError($"There is a problem with the connection to {device.Cart.Name} - {device.DeviceId}");
                _log.ExternalError($"Attempting reconnection in {SerialPortConstants.Health_Check_Milliseconds}.");

                var currentState = await device.SerialState.CurrentState.FirstAsync();

                if (currentState is not SerialConnectionLostState)
                {
                    device.SerialState.TransitionTo(typeof(SerialConnectionLostState));
                }
            }
            return device;
        }

        private IDisposable? _healthCheckSubscription;
    }
}
