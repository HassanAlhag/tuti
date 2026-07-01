export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "ar"];

export function getLocalizedField(item, field, locale = DEFAULT_LOCALE) {
  if (!item) return undefined;
  if (locale === "ar") {
    const arValue = item[`${field}Ar`];
    if (arValue) return arValue;
  }
  return item[field];
}
