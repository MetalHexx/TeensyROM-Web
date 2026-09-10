
# PlayerSettingsDto


## Properties

Name | Type
------------ | -------------
`repeatModeOnStartup` | boolean
`playTimerEnabled` | boolean
`muteFastForward` | boolean
`muteRandomSeek` | boolean
`startupFilter` | [TeensyFilterType](TeensyFilterType.md)
`startupLaunchEnabled` | boolean
`startupLaunchRandom` | boolean

## Example

```typescript
import type { PlayerSettingsDto } from ''

// TODO: Update the object below with actual values
const example = {
  "repeatModeOnStartup": null,
  "playTimerEnabled": null,
  "muteFastForward": null,
  "muteRandomSeek": null,
  "startupFilter": null,
  "startupLaunchEnabled": null,
  "startupLaunchRandom": null,
} satisfies PlayerSettingsDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PlayerSettingsDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


