
# CartStorageDto


## Properties

Name | Type
------------ | -------------
`deviceId` | string
`type` | [TeensyStorageType](TeensyStorageType.md)
`available` | boolean

## Example

```typescript
import type { CartStorageDto } from ''

// TODO: Update the object below with actual values
const example = {
  "deviceId": null,
  "type": null,
  "available": null,
} satisfies CartStorageDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CartStorageDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


