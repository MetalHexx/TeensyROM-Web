
# IndexingStatusDto


## Properties

Name | Type
------------ | -------------
`sdLastIndexed` | Date
`usbLastIndexed` | Date

## Example

```typescript
import type { IndexingStatusDto } from ''

// TODO: Update the object below with actual values
const example = {
  "sdLastIndexed": null,
  "usbLastIndexed": null,
} satisfies IndexingStatusDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as IndexingStatusDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


