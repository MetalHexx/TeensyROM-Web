
# SaveFavoriteResponse


## Properties

Name | Type
------------ | -------------
`message` | string
`favoriteFile` | [FileItemDto](FileItemDto.md)
`favoritePath` | string

## Example

```typescript
import type { SaveFavoriteResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "message": null,
  "favoriteFile": null,
  "favoritePath": null,
} satisfies SaveFavoriteResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SaveFavoriteResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


