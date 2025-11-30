
# LaunchFileResponse


## Properties

Name | Type
------------ | -------------
`message` | string
`launchedFile` | [FileItemDto](FileItemDto.md)
`isCompatible` | boolean

## Example

```typescript
import type { LaunchFileResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "message": null,
  "launchedFile": null,
  "isCompatible": null,
} satisfies LaunchFileResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as LaunchFileResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


