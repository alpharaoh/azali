import * as flags from "country-flag-icons/react/3x2";

/**
 * Flag component for an ISO 3166-1 alpha-2 country code, or undefined for
 * unknown codes.
 */
export function getCountryFlag(code: string) {
  // biome-ignore lint/performance/noDynamicNamespaceImportAccess: flags are picked by runtime country code, so the full set has to be bundled.
  return flags[code.toUpperCase() as keyof typeof flags];
}
