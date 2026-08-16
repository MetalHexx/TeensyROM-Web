
# SearchResponse


## Properties

Name | Type
------------ | -------------
`files` | [Array&lt;FileItemDto&gt;](FileItemDto.md)
`searchText` | string
`totalCount` | number
`count` | number
`skip` | number
`take` | number
`hasMore` | boolean
`message` | string

## Example

```typescript
import type { SearchResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "files": null,
  "searchText": null,
  "totalCount": null,
  "count": null,
  "skip": null,
  "take": null,
  "hasMore": null,
  "message": null,
} satisfies SearchResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SearchResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


