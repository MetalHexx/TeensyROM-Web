# PlayerApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**launchFile**](PlayerApi.md#launchfile) | **POST** /api/devices/{deviceId}/storage/{storageType}/launch | Launch File |
| [**launchRandom**](PlayerApi.md#launchrandom) | **POST** /api/devices/{deviceId}/storage/{storageType}/random-launch | Launch Random File |
| [**toggleMusic**](PlayerApi.md#togglemusic) | **POST** /api/devices/{deviceId}/toggle-music | Toggle Music Playback |



## launchFile

> LaunchFileResponse launchFile(deviceId, storageType, filePath)

Launch File

Launches a file given a valid path to a file stored on the TeensyRom.

### Example

```ts
import {
  Configuration,
  PlayerApi,
} from '';
import type { LaunchFileRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PlayerApi();

  const body = {
    // string
    deviceId: deviceId_example,
    // TeensyStorageType
    storageType: ...,
    // string
    filePath: filePath_example,
  } satisfies LaunchFileRequest;

  try {
    const data = await api.launchFile(body);
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
| **storageType** | `TeensyStorageType` |  | [Defaults to `undefined`] [Enum: SD, USB] |
| **filePath** | `string` |  | [Defaults to `undefined`] |

### Return type

[**LaunchFileResponse**](LaunchFileResponse.md)

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
| **502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## launchRandom

> LaunchRandomResponse launchRandom(deviceId, storageType, filterType, scope, startingDirectory)

Launch Random File

Launches a random file given a device, storage, filter and starting directory location.  - Starting Directory: Starting directory to look for a random file. - Scope: &#x60;Storage&#x60; - Selects a random file anywhere on the specified storage device. - Scope: &#x60;DirDeep&#x60; - Selects a random file from the starting directory or any of its subdirectories. - Scope: &#x60;DirShallow&#x60; - Selects a random file from the starting directory only (subdirectories are not included). - Filter: &#x60;All&#x60; - Any file type will be randomly selected. - Filter: &#x60;Games&#x60; - Only game-related files will be selected (e.g., .prg, .crt, .d64, etc). Includes demos and non-games. - Filter: &#x60;Music&#x60; - Only music or song files will be selected (e.g., .sid, .mus, .mp3, etc). - Filter: &#x60;Images&#x60; - Only image files will be selected (e.g., .koa, .png, etc). Also includes text files (may be improved in a future release)

### Example

```ts
import {
  Configuration,
  PlayerApi,
} from '';
import type { LaunchRandomRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PlayerApi();

  const body = {
    // string
    deviceId: deviceId_example,
    // TeensyStorageType
    storageType: ...,
    // NullableOfTeensyFilterType (optional)
    filterType: ...,
    // 'Storage' | 'DirDeep' | 'DirShallow' | 'null' (optional)
    scope: scope_example,
    // string (optional)
    startingDirectory: startingDirectory_example,
  } satisfies LaunchRandomRequest;

  try {
    const data = await api.launchRandom(body);
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
| **storageType** | `TeensyStorageType` |  | [Defaults to `undefined`] [Enum: SD, USB] |
| **filterType** | `NullableOfTeensyFilterType` |  | [Optional] [Defaults to `undefined`] [Enum: All, Games, Music, Hex, Images, ] |
| **scope** | `Storage`, `DirDeep`, `DirShallow`, `` |  | [Optional] [Defaults to `undefined`] [Enum: Storage, DirDeep, DirShallow, ] |
| **startingDirectory** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**LaunchRandomResponse**](LaunchRandomResponse.md)

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
| **404** | Not Found |  -  |
| **502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## toggleMusic

> ToggleMusicResponse toggleMusic(deviceId)

Toggle Music Playback

Toggles the play/pause state of the currently playing music on the TeensyRom device.

### Example

```ts
import {
  Configuration,
  PlayerApi,
} from '';
import type { ToggleMusicRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PlayerApi();

  const body = {
    // string
    deviceId: deviceId_example,
  } satisfies ToggleMusicRequest;

  try {
    const data = await api.toggleMusic(body);
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

[**ToggleMusicResponse**](ToggleMusicResponse.md)

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
| **404** | Not Found |  -  |
| **502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

