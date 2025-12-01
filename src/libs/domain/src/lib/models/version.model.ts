/**
 * Application version model.
 *
 * Represents the current version of the TeensyROM application
 * following semantic versioning conventions.
 */
export interface AppVersion {
  /**
   * Version string in semantic versioning format.
   * Examples: "1.0.0", "1.0.0-alpha.1", "2.1.0-beta.3"
   */
  version: string;
}
