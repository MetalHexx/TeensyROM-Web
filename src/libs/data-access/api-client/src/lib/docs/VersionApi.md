# VersionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getVersion**](VersionApi.md#getversion) | **GET** /api/version | Get Application Version |



## getVersion

> GetVersionResponse getVersion()

Get Application Version

Retrieves the current semantic version of the TeensyROM application.  The version follows semantic versioning format: **Major.Minor.Patch[-prerelease]**  **Version Information:** - **Major**: Breaking changes or significant new features - **Minor**: Backward-compatible new features - **Patch**: Backward-compatible bug fixes - **Prerelease**: Optional prerelease identifier (e.g., alpha.1, beta.2)  This version is read from the assembly metadata and matches the version specified in the TeensyRom.Api.csproj file.

### Example

```ts
import {
  Configuration,
  VersionApi,
} from '';
import type { GetVersionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VersionApi();

  try {
    const data = await api.getVersion();
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

[**GetVersionResponse**](GetVersionResponse.md)

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

