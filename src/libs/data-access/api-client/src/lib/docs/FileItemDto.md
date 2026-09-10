
# FileItemDto


## Properties

Name | Type
------------ | -------------
`name` | string
`path` | string
`size` | number
`storageType` | [TeensyStorageType](TeensyStorageType.md)
`isFavorite` | boolean
`isCompatible` | boolean
`title` | string
`creator` | string
`releaseInfo` | string
`description` | string
`shareUrl` | string
`metadataSource` | string
`meta1` | string
`meta2` | string
`links` | [Array&lt;FileLinkDto&gt;](FileLinkDto.md)
`tags` | [Array&lt;FileTagDto&gt;](FileTagDto.md)
`youTubeVideos` | [Array&lt;YouTubeVideoDto&gt;](YouTubeVideoDto.md)
`competitions` | [Array&lt;CompetitionDto&gt;](CompetitionDto.md)
`avgRating` | number
`ratingCount` | number
`metadataSourcePath` | string
`parentPath` | string
`playLength` | string
`subtuneLengths` | Array&lt;string&gt;
`startSubtuneNum` | number
`images` | [Array&lt;ViewableItemImageDto&gt;](ViewableItemImageDto.md)
`type` | [FileItemType](FileItemType.md)

## Example

```typescript
import type { FileItemDto } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "path": null,
  "size": null,
  "storageType": null,
  "isFavorite": null,
  "isCompatible": null,
  "title": null,
  "creator": null,
  "releaseInfo": null,
  "description": null,
  "shareUrl": null,
  "metadataSource": null,
  "meta1": null,
  "meta2": null,
  "links": null,
  "tags": null,
  "youTubeVideos": null,
  "competitions": null,
  "avgRating": null,
  "ratingCount": null,
  "metadataSourcePath": null,
  "parentPath": null,
  "playLength": null,
  "subtuneLengths": null,
  "startSubtuneNum": null,
  "images": null,
  "type": null,
} satisfies FileItemDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FileItemDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


