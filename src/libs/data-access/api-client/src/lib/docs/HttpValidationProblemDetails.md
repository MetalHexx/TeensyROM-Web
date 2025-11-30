
# HttpValidationProblemDetails


## Properties

Name | Type
------------ | -------------
`type` | string
`title` | string
`status` | number
`detail` | string
`instance` | string
`errors` | { [key: string]: Array&lt;string&gt;; }

## Example

```typescript
import type { HttpValidationProblemDetails } from ''

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "title": null,
  "status": null,
  "detail": null,
  "instance": null,
  "errors": null,
} satisfies HttpValidationProblemDetails

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as HttpValidationProblemDetails
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


