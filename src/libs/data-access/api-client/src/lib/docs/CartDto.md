
# CartDto


## Properties

Name | Type
------------ | -------------
`deviceId` | string
`isConnected` | boolean
`deviceState` | [DeviceState](DeviceState.md)
`comPort` | string
`connectionType` | [ConnectionType](ConnectionType.md)
`ipAddress` | string
`tcpPort` | number
`name` | string
`fwVersion` | string
`isCompatible` | boolean
`sdStorage` | [CartStorageDto](CartStorageDto.md)
`usbStorage` | [CartStorageDto](CartStorageDto.md)

## Example

```typescript
import type { CartDto } from ''

// TODO: Update the object below with actual values
const example = {
  "deviceId": null,
  "isConnected": null,
  "deviceState": null,
  "comPort": null,
  "connectionType": null,
  "ipAddress": null,
  "tcpPort": null,
  "name": null,
  "fwVersion": null,
  "isCompatible": null,
  "sdStorage": null,
  "usbStorage": null,
} satisfies CartDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CartDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


