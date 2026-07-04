import { countries } from "country-flag-icons";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string) {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export interface CountryItem {
  code: string;
  name: string;
}

// All ISO 3166-1 alpha-2 countries with English display names, A→Z.
export const COUNTRY_ITEMS: CountryItem[] = countries
  .map((code) => ({ code, name: countryName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));
