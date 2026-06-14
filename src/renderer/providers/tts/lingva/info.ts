export const info = {
  name: 'lingva',
  icon: 'logo/lingva.svg',
}

export const Language = {
  zh_cn: 'zh',
  zh_tw: 'zh',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  es: 'es',
  ru: 'ru',
  de: 'de',
  it: 'it',
  tr: 'tr',
  pt_pt: 'pt',
  pt_br: 'pt',
  vi: 'vi',
  id: 'id',
  th: 'th',
  ms: 'ms',
  ar: 'ar',
  hi: 'hi',
  km: 'km',
  nb_no: 'no',
  nn_no: 'no',
  sv: 'sv',
  pl: 'pl',
  nl: 'nl',
  uk: 'uk',
  he: 'he',
} as const

export type Language = (typeof Language)[keyof typeof Language]
