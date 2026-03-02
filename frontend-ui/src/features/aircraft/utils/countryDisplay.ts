const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function getCountryName(countryCode: string | null | undefined): string | null {
  if (!countryCode) {
    return null;
  }

  const normalizedCode = countryCode.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  return COUNTRY_NAMES.of(normalizedCode) ?? normalizedCode;
}
