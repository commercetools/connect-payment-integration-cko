const supportedLocales = [
  "ar",
  "da-DK",
  "de-DE",
  "el",
  "en-GB",
  "es-ES",
  "fi-FI",
  "fil-PH",
  "fr-FR",
  "hi-IN",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "ms-MY",
  "nb-NO",
  "nl-NL",
  "pt-PT",
  "sv-SE",
  "th-TH",
  "vi-VN",
  "zh-CN",
  "zh-HK",
  "zh-TW",
];

const localeMappings: Record<string, string> = {
  "no-NO": "nb-NO",
};

export const convertToCkoLocale = (locale: string): string => {
  // Normalize the input locale: replace "_" with "-" and convert to lowercase
  const normalizedLocale = locale.replace("_", "-").toLowerCase();

  // Check for an exact match (case-insensitive)
  const exactMatch = supportedLocales.find((supportedLocale) => supportedLocale.toLowerCase() === normalizedLocale);
  if (exactMatch) {
    return exactMatch;
  }

  // Search for a partial match (base locale, e.g., "es" -> "es-ES")
  const baseLocale = normalizedLocale.split("-")[0];
  const partialMatch = supportedLocales.find((supportedLocale) => supportedLocale.toLowerCase().startsWith(baseLocale));

  if (partialMatch) {
    return partialMatch;
  }

  // Check for specific mappings
  const mappedLocale = localeMappings[normalizedLocale];
  if (mappedLocale) {
    return mappedLocale;
  }

  // Fallback to a default locale if no match is found
  return "en-GB";
};
