# TransfersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**cancelTransferJob**](TransfersApi.md#canceltransferjob) | **POST** /api/transfers/{jobId}/cancel | Cancel Transfer Job |
| [**createTransferJob**](TransfersApi.md#createtransferjob) | **POST** /api/devices/{deviceId}/storage/{storageType}/transfers | Create Transfer Job |
| [**getActiveTransferJob**](TransfersApi.md#getactivetransferjob) | **GET** /api/devices/{deviceId}/transfers/active | Get Active Transfer Job |
| [**getTransferJob**](TransfersApi.md#gettransferjob) | **GET** /api/transfers/{jobId} | Get Transfer Job |
| [**sealTransferJob**](TransfersApi.md#sealtransferjob) | **POST** /api/transfers/{jobId}/seal | Seal Transfer Job |
| [**uploadTransferFile**](TransfersApi.md#uploadtransferfile) | **POST** /api/transfers/{jobId}/files | Upload Transfer File |



## cancelTransferJob

> CancelJobResponse cancelTransferJob(jobId)

Cancel Transfer Job

Cancels a transfer job.  - Returns the job already cancelled: its device, staged files, and expansion workspace are all released before this responds, so the device can immediately take a new job. Files already handed to the device are discarded rather than sent. - Idempotent: cancelling an already-cancelled job returns success, as does cancelling any other terminal job, without changing anything.

### Example

```ts
import {
  Configuration,
  TransfersApi,
} from '';
import type { CancelTransferJobRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TransfersApi();

  const body = {
    // string
    jobId: jobId_example,
  } satisfies CancelTransferJobRequest;

  try {
    const data = await api.cancelTransferJob(body);
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
| **jobId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**CancelJobResponse**](CancelJobResponse.md)

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


## createTransferJob

> CreateJobResponse createTransferJob(deviceId, storageType, createJobBody)

Create Transfer Job

Starts a new file transfer job for a device\&#39;s storage.  - Acquires an exclusive lease on the device for the lifetime of the job - a device can only have one active transfer at a time. - Issues no device traffic - the device reset happens on the first uploaded file.

### Example

```ts
import {
  Configuration,
  TransfersApi,
} from '';
import type { CreateTransferJobRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TransfersApi();

  const body = {
    // string
    deviceId: deviceId_example,
    // TeensyStorageType
    storageType: ...,
    // CreateJobBody
    createJobBody: ...,
  } satisfies CreateTransferJobRequest;

  try {
    const data = await api.createTransferJob(body);
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
| **createJobBody** | [CreateJobBody](CreateJobBody.md) |  | |

### Return type

[**CreateJobResponse**](CreateJobResponse.md)

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
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getActiveTransferJob

> GetActiveJobResponse getActiveTransferJob(deviceId)

Get Active Transfer Job

Gets the device\&#39;s currently active transfer job.  - Returns 200 with a null job when the device has no transfer in progress - an idle device is a normal answer, not a 404.

### Example

```ts
import {
  Configuration,
  TransfersApi,
} from '';
import type { GetActiveTransferJobRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TransfersApi();

  const body = {
    // string
    deviceId: deviceId_example,
  } satisfies GetActiveTransferJobRequest;

  try {
    const data = await api.getActiveTransferJob(body);
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

[**GetActiveJobResponse**](GetActiveJobResponse.md)

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


## getTransferJob

> GetJobResponse getTransferJob(jobId)

Get Transfer Job

Gets the current snapshot of a transfer job - the same shape the transfer hub pushes over SignalR, so a client can poll this endpoint instead of subscribing.

### Example

```ts
import {
  Configuration,
  TransfersApi,
} from '';
import type { GetTransferJobRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TransfersApi();

  const body = {
    // string
    jobId: jobId_example,
  } satisfies GetTransferJobRequest;

  try {
    const data = await api.getTransferJob(body);
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
| **jobId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**GetJobResponse**](GetJobResponse.md)

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


## sealTransferJob

> SealJobResponse sealTransferJob(jobId)

Seal Transfer Job

Marks a transfer job as sealed - no further files will be accepted.  - Idempotent when the job is already sealed. - Rejected with a clear message when the job cannot reach Sealed from its current state. - A job sealed with an empty queue reaches Completed immediately - no upload required.

### Example

```ts
import {
  Configuration,
  TransfersApi,
} from '';
import type { SealTransferJobRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TransfersApi();

  const body = {
    // string
    jobId: jobId_example,
  } satisfies SealTransferJobRequest;

  try {
    const data = await api.sealTransferJob(body);
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
| **jobId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**SealJobResponse**](SealJobResponse.md)

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


## uploadTransferFile

> UploadFileResponse uploadTransferFile(jobId, path)

Upload Transfer File

Streams a single file\&#39;s raw body (application/octet-stream) into a transfer job.  - One file per request; the body is streamed straight to disk, never buffered. - Blocks until the capacity gate has a free slot instead of failing - a slow device shows up as a slower response, never as an error. - Rejected immediately (400) when the job cannot accept files, and before any file is staged when the relative path is unusable.

### Example

```ts
import {
  Configuration,
  TransfersApi,
} from '';
import type { UploadTransferFileRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TransfersApi();

  const body = {
    // string
    jobId: jobId_example,
    // string
    path: path_example,
  } satisfies UploadTransferFileRequest;

  try {
    const data = await api.uploadTransferFile(body);
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
| **jobId** | `string` |  | [Defaults to `undefined`] |
| **path** | `string` |  | [Defaults to `undefined`] |

### Return type

[**UploadFileResponse**](UploadFileResponse.md)

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

