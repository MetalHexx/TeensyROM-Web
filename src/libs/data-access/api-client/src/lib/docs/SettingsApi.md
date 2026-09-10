# SettingsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getSettings**](SettingsApi.md#getsettings) | **GET** /api/settings | Get User Settings |
| [**saveSettings**](SettingsApi.md#savesettingsoperation) | **POST** /api/settings | Save User Settings |



## getSettings

> GetSettingsResponse getSettings()

Get User Settings

Retrieves all current user settings for the TeensyROM application.  **Settings Categories:** - **Connection Settings**: Device connectivity preferences (Serial/TCP) - **Player Settings**: Playback behavior and startup preferences - **File Transfer Settings**: Auto-copy and directory watching configuration - **Search Settings**: Search weights, stop words, and content exclusions - **App Settings**: Application lifecycle state  Settings are loaded from the Settings.json file and cached in memory. This endpoint always returns the current in-memory settings state.

### Example

```ts
import {
  Configuration,
  SettingsApi,
} from '';
import type { GetSettingsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SettingsApi();

  try {
    const data = await api.getSettings();
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

[**GetSettingsResponse**](GetSettingsResponse.md)

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


## saveSettings

> SaveSettingsResponse saveSettings(saveSettingsRequest)

Save User Settings

Saves all user settings for the TeensyROM application to persistent storage.  **Settings Categories:** - **Connection Settings**: Device connectivity preferences (Serial/TCP)   - Serial: Port name (empty for auto-detect) and baud rate (typically 115200)   - TCP: Host address, port (1-65535), and timeout values (milliseconds) - **Player Settings**: Playback behavior and startup preferences   - Repeat mode, play timer, mute settings, startup filter and launch options - **File Transfer Settings**: Auto-copy and directory watching configuration   - Watch directory location, auto-transfer path, and sync flags - **Search Settings**: Search weights, stop words, and content exclusions   - Search weights must be &gt;&#x3D; 0 with at least one &gt; 0   - Stop words, banned directories, and banned files lists - **App Settings**: Application lifecycle state   - First-time setup flag  **Validation:** - All nested settings objects are required - Baud rate must be positive (typically 9600, 19200, 38400, 57600, or 115200) - TCP port must be between 1 and 65535 - Timeout values must be positive integers (milliseconds) - Watch directory must be empty or a valid absolute path - Search weights must be non-negative with at least one &gt; 0  Settings are persisted to Settings.json and immediately available in memory.

### Example

```ts
import {
  Configuration,
  SettingsApi,
} from '';
import type { SaveSettingsOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SettingsApi();

  const body = {
    // SaveSettingsRequest
    saveSettingsRequest: ...,
  } satisfies SaveSettingsOperationRequest;

  try {
    const data = await api.saveSettings(body);
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
| **saveSettingsRequest** | [SaveSettingsRequest](SaveSettingsRequest.md) |  | |

### Return type

[**SaveSettingsResponse**](SaveSettingsResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

