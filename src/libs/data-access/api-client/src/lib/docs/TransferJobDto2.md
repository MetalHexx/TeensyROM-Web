
# TransferJobDto2


## Properties

Name | Type
------------ | -------------
`jobId` | string
`deviceId` | string
`storageType` | [TeensyStorageType](TeensyStorageType.md)
`destinationDirectory` | string
`state` | [TransferJobState](TransferJobState.md)
`filesReceived` | number
`filesSent` | number
`filesFailed` | number
`bytesSent` | number
`totalFiles` | number
`currentFile` | string
`startedUtc` | Date
`lastActivityUtc` | Date
`error` | string
`failures` | [Array&lt;TransferFileCompleted&gt;](TransferFileCompleted.md)
`recentCompletions` | [Array&lt;TransferFileCompleted&gt;](TransferFileCompleted.md)
`bytesPerSecond` | number
`filesPerSecond` | number
`expandingArchive` | string
`expansionBytesWritten` | number
`expansionBytesDeclared` | number
`expandedFileCount` | number

## Example

```typescript
import type { TransferJobDto2 } from ''

// TODO: Update the object below with actual values
const example = {
  "jobId": null,
  "deviceId": null,
  "storageType": null,
  "destinationDirectory": null,
  "state": null,
  "filesReceived": null,
  "filesSent": null,
  "filesFailed": null,
  "bytesSent": null,
  "totalFiles": null,
  "currentFile": null,
  "startedUtc": null,
  "lastActivityUtc": null,
  "error": null,
  "failures": null,
  "recentCompletions": null,
  "bytesPerSecond": null,
  "filesPerSecond": null,
  "expandingArchive": null,
  "expansionBytesWritten": null,
  "expansionBytesDeclared": null,
  "expandedFileCount": null,
} satisfies TransferJobDto2

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TransferJobDto2
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


