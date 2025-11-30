# FilesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getDirectory**](FilesApi.md#getdirectory) | **GET** /api/devices/{deviceId}/storage/{storageType}/directories | Get Directory |
| [**index**](FilesApi.md#index) | **POST** /api/devices/{deviceId}/storage/{storageType}/index | Index |
| [**indexAll**](FilesApi.md#indexall) | **POST** /api/files/index/all | Index All |
| [**removeFavorite**](FilesApi.md#removefavorite) | **DELETE** /api/devices/{deviceId}/storage/{storageType}/favorite | Remove Favorite |
| [**saveFavorite**](FilesApi.md#savefavorite) | **POST** /api/devices/{deviceId}/storage/{storageType}/favorite | Save Favorite |
| [**search**](FilesApi.md#search) | **GET** /api/devices/{deviceId}/storage/{storageType}/search | Search Files |



## getDirectory

> GetDirectoryResponse getDirectory(deviceId, storageType, path)

Get Directory

Gets a directory for given storage device.  - Returns metadata for all files in the directory. - This is not recursive and will only include the files for the requested directory. - Make another request to get subdirectory content.

### Example

```ts
import {
  Configuration,
  FilesApi,
} from '';
import type { GetDirectoryRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FilesApi();

  const body = {
    // string
    deviceId: deviceId_example,
    // TeensyStorageType
    storageType: ...,
    // string (optional)
    path: path_example,
  } satisfies GetDirectoryRequest;

  try {
    const data = await api.getDirectory(body);
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
| **path** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**GetDirectoryResponse**](GetDirectoryResponse.md)

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


## index

> IndexResponse index(deviceId, storageType, startingPath)

Index

Indexes the directory structure of a given TeensyROM device and storage type.  - Providing a path will index starting at that directory and all subdirectories below it. - Providing no path will index the whole storage device. - Don\&#39;t touch your commodore while indexing is in progress.

### Example

```ts
import {
  Configuration,
  FilesApi,
} from '';
import type { IndexRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FilesApi();

  const body = {
    // string
    deviceId: deviceId_example,
    // TeensyStorageType
    storageType: ...,
    // string (optional)
    startingPath: startingPath_example,
  } satisfies IndexRequest;

  try {
    const data = await api.index(body);
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
| **startingPath** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**IndexResponse**](IndexResponse.md)

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


## indexAll

> IndexAllResponse indexAll()

Index All

Indexes all storage for all connected TeensyROM devices.  - This will recursively index all storage devices. - Multiple devices will be indexed in parallel, one device type at a time. - This could take a few minutes if you have a lot of data. - Don\&#39;t touch your commodores while indexing is in progress.

### Example

```ts
import {
  Configuration,
  FilesApi,
} from '';
import type { IndexAllRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FilesApi();

  try {
    const data = await api.indexAll();
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

[**IndexAllResponse**](IndexAllResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## removeFavorite

> RemoveFavoriteResponse removeFavorite(deviceId, storageType, filePath)

Remove Favorite

Removes a file from favorites, deleting the favorite copy and updating the original file\&#39;s favorite status.

### Example

```ts
import {
  Configuration,
  FilesApi,
} from '';
import type { RemoveFavoriteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FilesApi();

  const body = {
    // string
    deviceId: deviceId_example,
    // TeensyStorageType
    storageType: ...,
    // string
    filePath: filePath_example,
  } satisfies RemoveFavoriteRequest;

  try {
    const data = await api.removeFavorite(body);
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

[**RemoveFavoriteResponse**](RemoveFavoriteResponse.md)

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


## saveFavorite

> SaveFavoriteResponse saveFavorite(deviceId, storageType, filePath)

Save Favorite

Saves a file as a favorite, creating a copy in the appropriate favorites directory.

### Example

```ts
import {
  Configuration,
  FilesApi,
} from '';
import type { SaveFavoriteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FilesApi();

  const body = {
    // string
    deviceId: deviceId_example,
    // TeensyStorageType
    storageType: ...,
    // string
    filePath: filePath_example,
  } satisfies SaveFavoriteRequest;

  try {
    const data = await api.saveFavorite(body);
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

[**SaveFavoriteResponse**](SaveFavoriteResponse.md)

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


## search

> SearchResponse search(deviceId, storageType, searchText, skip, take, filterType)

Search Files

Searches for files in the specified storage device based on search text and filter criteria.  - Searches through file names, titles, creators, and descriptions. - Returns metadata for all matching files. - Supports file type filtering (All, Games, Music, Images, Hex). - Supports pagination with Skip and Take parameters. - Excludes favorites and playlist directories from search results. - Uses weighted search algorithm to rank results by relevance. - Default page size is 50, maximum is 200.

### Example

```ts
import {
  Configuration,
  FilesApi,
} from '';
import type { SearchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FilesApi();

  const body = {
    // string
    deviceId: deviceId_example,
    // TeensyStorageType
    storageType: ...,
    // string
    searchText: searchText_example,
    // number
    skip: 56,
    // number
    take: 56,
    // NullableOfTeensyFilterType (optional)
    filterType: ...,
  } satisfies SearchRequest;

  try {
    const data = await api.search(body);
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
| **searchText** | `string` |  | [Defaults to `undefined`] |
| **skip** | `number` |  | [Defaults to `undefined`] |
| **take** | `number` |  | [Defaults to `undefined`] |
| **filterType** | `NullableOfTeensyFilterType` |  | [Optional] [Defaults to `undefined`] [Enum: All, Games, Music, Hex, Images, ] |

### Return type

[**SearchResponse**](SearchResponse.md)

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

