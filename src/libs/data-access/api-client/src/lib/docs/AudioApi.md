# AudioApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listAudioDevices**](AudioApi.md#listaudiodevices) | **GET** /api/audio/devices | List Audio Input Devices |



## listAudioDevices

> ListDevicesResponse listAudioDevices()

List Audio Input Devices

Enumerates all available audio input devices on the host system.  **Use Case:** Call this endpoint when configuring audio streaming settings to present the user with a list of audio devices to choose from.  **Device Information:** - **Index**: Device identifier used to select the device for capture - **Name**: Human-readable device name for display in UI - **MaxInputChannels**: Number of audio channels the device supports - **DefaultSampleRate**: The device\&#39;s preferred sample rate  Returns an empty list if no audio input devices are available.

### Example

```ts
import {
  Configuration,
  AudioApi,
} from '';
import type { ListAudioDevicesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AudioApi();

  try {
    const data = await api.listAudioDevices();
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

[**ListDevicesResponse**](ListDevicesResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

