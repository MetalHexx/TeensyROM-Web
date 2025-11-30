# DevicesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**connectDevice**](DevicesApi.md#connectdevice) | **POST** /api/devices/{deviceId}/connect | Connect Device |
| [**disconnectDevice**](DevicesApi.md#disconnectdevice) | **DELETE** /api/devices/{deviceId} | Disconnect Device |
| [**findDevices**](DevicesApi.md#finddevices) | **GET** /api/devices | Find Devices |
| [**pingDevice**](DevicesApi.md#pingdevice) | **GET** /api/devices/{deviceId}/ping | Ping Device |
| [**resetDevice**](DevicesApi.md#resetdevice) | **PUT** /api/devices/{deviceId}/reset | Reset Device |
| [**startDeviceEvents**](DevicesApi.md#startdeviceevents) | **GET** /api/devices/events | Start Device Event Stream |
| [**startLogs**](DevicesApi.md#startlogs) | **POST** /api/logs | Start Logging Hub |
| [**stopDeviceEvents**](DevicesApi.md#stopdeviceevents) | **DELETE** /api/devices/events | Stop Device Event Stream |
| [**stopLogs**](DevicesApi.md#stoplogs) | **DELETE** /api/logs | Stop Logging Channel |



## connectDevice

> ConnectDeviceResponse connectDevice(deviceId)

Connect Device

Connects to a TeensyROM device.  - You must be connected to a TeensyROM device in order to call most other endpoints.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { ConnectDeviceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  const body = {
    // string
    deviceId: deviceId_example,
  } satisfies ConnectDeviceRequest;

  try {
    const data = await api.connectDevice(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **deviceId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**ConnectDeviceResponse**](ConnectDeviceResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## disconnectDevice

> DisconnectDeviceResponse disconnectDevice(deviceId)

Disconnect Device

Disconnnects from a TeensyROM device.  - Once you disconnect from a device, most endpoints won\&#39;t work until you reconnect.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { DisconnectDeviceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  const body = {
    // string
    deviceId: deviceId_example,
  } satisfies DisconnectDeviceRequest;

  try {
    const data = await api.disconnectDevice(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **deviceId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**DisconnectDeviceResponse**](DisconnectDeviceResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## findDevices

> FindDevicesResponse findDevices()

Find Devices

Returns all available and connected TeensyROM devices.  - This will momentarily disconnect all devices. - All available COM ports will be scanned for TeensyROM devices. - Devices with auto-connect enabled will reconnect automatically.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { FindDevicesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  try {
    const data = await api.findDevices();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**FindDevicesResponse**](FindDevicesResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **503** | Service Unavailable |  -  |
| **400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## pingDevice

> PingDeviceResponse pingDevice(deviceId)

Ping Device

Pings a TeensyROM device to check if it is responsive.  - Works the same as clicking the cartridge reset button.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { PingDeviceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  const body = {
    // string
    deviceId: deviceId_example,
  } satisfies PingDeviceRequest;

  try {
    const data = await api.pingDevice(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **deviceId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**PingDeviceResponse**](PingDeviceResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## resetDevice

> ResetDeviceResponse resetDevice(deviceId)

Reset Device

Resets a TeensyROM device.  - Works the same as clicking the cartridge reset button.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { ResetDeviceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  const body = {
    // string
    deviceId: deviceId_example,
  } satisfies ResetDeviceRequest;

  try {
    const data = await api.resetDevice(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **deviceId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**ResetDeviceResponse**](ResetDeviceResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## startDeviceEvents

> DeviceStartResponse startDeviceEvents()

Start Device Event Stream

Starts the device event stream.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { StartDeviceEventsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  try {
    const data = await api.startDeviceEvents();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**DeviceStartResponse**](DeviceStartResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## startLogs

> StartLogsResponse startLogs()

Start Logging Hub

Starts the logging service and returns a success message.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { StartLogsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  try {
    const data = await api.startLogs();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**StartLogsResponse**](StartLogsResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## stopDeviceEvents

> DeviceStopResponse stopDeviceEvents()

Stop Device Event Stream

Stops the device event stream.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { StopDeviceEventsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  try {
    const data = await api.stopDeviceEvents();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**DeviceStopResponse**](DeviceStopResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## stopLogs

> StopLogsResponse stopLogs()

Stop Logging Channel

Stops the logging service and returns a success message.

### Example

```ts
import {
  Configuration,
  DevicesApi,
} from '';
import type { StopLogsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DevicesApi();

  try {
    const data = await api.stopLogs();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**StopLogsResponse**](StopLogsResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

