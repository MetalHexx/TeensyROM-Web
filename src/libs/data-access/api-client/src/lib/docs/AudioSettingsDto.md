
# AudioSettingsDto


## Properties

Name | Type
------------ | -------------
`enableAudioStream` | boolean
`audioDeviceIndex` | number
`audioDeviceName` | string
`captureChannelCount` | number
`sampleRate` | number
`channels` | [Array&lt;ChannelConfigDto&gt;](ChannelConfigDto.md)
`useOpusEncoding` | boolean

## Example

```typescript
import type { AudioSettingsDto } from ''

// TODO: Update the object below with actual values
const example = {
  "enableAudioStream": null,
  "audioDeviceIndex": null,
  "audioDeviceName": null,
  "captureChannelCount": null,
  "sampleRate": null,
  "channels": null,
  "useOpusEncoding": null,
} satisfies AudioSettingsDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AudioSettingsDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


