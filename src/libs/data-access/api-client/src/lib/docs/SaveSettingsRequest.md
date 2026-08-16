
# SaveSettingsRequest


## Properties

Name | Type
------------ | -------------
`knownDevices` | [Array&lt;DeviceSettingsDto&gt;](DeviceSettingsDto.md)
`playerSettings` | [PlayerSettingsDto](PlayerSettingsDto.md)
`fileTransferSettings` | [FileTransferSettingsDto](FileTransferSettingsDto.md)
`searchSettings` | [SearchSettingsDto](SearchSettingsDto.md)
`appSettings` | [AppSettingsDto](AppSettingsDto.md)

## Example

```typescript
import type { SaveSettingsRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "knownDevices": null,
  "playerSettings": null,
  "fileTransferSettings": null,
  "searchSettings": null,
  "appSettings": null,
} satisfies SaveSettingsRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SaveSettingsRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


