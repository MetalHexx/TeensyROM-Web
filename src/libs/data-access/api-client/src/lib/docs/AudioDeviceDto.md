
# AudioDeviceDto


## Properties

Name | Type
------------ | -------------
`index` | number
`name` | string
`maxInputChannels` | number
`defaultSampleRate` | number

## Example

```typescript
import type { AudioDeviceDto } from ''

// TODO: Update the object below with actual values
const example = {
  "index": null,
  "name": null,
  "maxInputChannels": null,
  "defaultSampleRate": null,
} satisfies AudioDeviceDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AudioDeviceDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


