export const info = {
  name: 'deepl',
  icon: 'logo/deepl.svg',
}

export const Language = {
  auto: 'auto',
  zh_cn: 'ZH-HANS',
  zh_tw: 'ZH-HANT',
  ja: 'JA',
  en: 'EN',
  ko: 'KO',
  fr: 'FR',
  es: 'ES',
  ru: 'RU',
  de: 'DE',
  it: 'IT',
  tr: 'TR',
  pt_pt: 'PT-PT',
  pt_br: 'PT-BR',
  id: 'ID',
  sv: 'SV',
  pl: 'PL',
  nl: 'NL',
  uk: 'UK',
} as const

export type Language = (typeof Language)[keyof typeof Language]
