
# TransferFileCompleted


## Properties

Name | Type
------------ | -------------
`jobId` | string
`relativePath` | string
`targetPath` | string
`success` | boolean
`error` | string
`sizeBytes` | number

## Example

```typescript
import type { TransferFileCompleted } from ''

// TODO: Update the object below with actual values
const example = {
  "jobId": null,
  "relativePath": null,
  "targetPath": null,
  "success": null,
  "error": null,
  "sizeBytes": null,
} satisfies TransferFileCompleted

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TransferFileCompleted
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


