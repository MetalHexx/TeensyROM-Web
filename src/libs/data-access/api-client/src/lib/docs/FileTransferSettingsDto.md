
# FileTransferSettingsDto


## Properties

Name | Type
------------ | -------------
`watchDirectoryLocation` | string
`autoTransferPath` | string
`autoFileCopyEnabled` | boolean
`autoLaunchOnCopyEnabled` | boolean
`navToDirOnLaunch` | boolean
`syncFilesEnabled` | boolean

## Example

```typescript
import type { FileTransferSettingsDto } from ''

// TODO: Update the object below with actual values
const example = {
  "watchDirectoryLocation": null,
  "autoTransferPath": null,
  "autoFileCopyEnabled": null,
  "autoLaunchOnCopyEnabled": null,
  "navToDirOnLaunch": null,
  "syncFilesEnabled": null,
} satisfies FileTransferSettingsDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FileTransferSettingsDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


