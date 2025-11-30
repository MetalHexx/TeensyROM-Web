
# DeviceSettingsDto


## Properties

Name | Type
------------ | -------------
`deviceId` | string
`videoSettings` | [VideoSettingsDto](VideoSettingsDto.md)
`connectionSettings` | [ConnectionSettingsDto](ConnectionSettingsDto.md)

## Example

```typescript
import type { DeviceSettingsDto } from ''

// TODO: Update the object below with actual values
const example = {
  "deviceId": null,
  "videoSettings": null,
  "connectionSettings": null,
} satisfies DeviceSettingsDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DeviceSettingsDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


