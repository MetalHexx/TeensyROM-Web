
# StorageCacheDto


## Properties

Name | Type
------------ | -------------
`directories` | [Array&lt;DirectoryItemDto&gt;](DirectoryItemDto.md)
`files` | [Array&lt;FileItemDto&gt;](FileItemDto.md)
`path` | string

## Example

```typescript
import type { StorageCacheDto } from ''

// TODO: Update the object below with actual values
const example = {
  "directories": null,
  "files": null,
  "path": null,
} satisfies StorageCacheDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as StorageCacheDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


