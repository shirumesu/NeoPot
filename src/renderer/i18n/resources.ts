export type TranslationResourceValue = string | TranslationResource

export interface TranslationResource {
  [key: string]: TranslationResourceValue
}

export interface LocaleResourceBundle {
  [namespace: string]: TranslationResource
  translation: TranslationResource
}

const localeModules = import.meta.glob<LocaleResourceBundle>('./locales/*.json', {
  eager: true,
  import: 'default',
})

const regionScopedLanguagePrefixes = new Set(['zh', 'pt'])

export function localeStemToLanguage(stem: string): string {
  const normalized = stem.toLowerCase().replace(/-/g, '_')
  const [language] = normalized.split('_')

  if (language && regionScopedLanguagePrefixes.has(language)) {
    return normalized
  }

  return language || normalized
}

function localePathToStem(localePath: string): string {
  return localePath.replace(/^.*[\\/]/, '').replace(/\.json$/, '')
}

function collectI18nResources(): Record<string, LocaleResourceBundle> {
  const resources: Record<string, LocaleResourceBundle> = {}

  for (const localePath of Object.keys(localeModules).sort()) {
    const stem = localePathToStem(localePath)
    const normalizedStem = stem.toLowerCase().replace(/-/g, '_')
    const language = localeStemToLanguage(stem)
    const resource = localeModules[localePath]

    if (!(language in resources)) {
      resources[language] = resource
    }
    resources[normalizedStem] = resource
  }

  return resources
}

function collectLocaleLanguages(): string[] {
  const languages = new Set<string>()

  for (const localePath of Object.keys(localeModules).sort()) {
    languages.add(localeStemToLanguage(localePathToStem(localePath)))
  }

  return [...languages]
}

export const i18nResources = collectI18nResources()

export const translationResources: Record<string, TranslationResource> = Object.fromEntries(
  Object.entries(i18nResources).map(([language, resource]) => [language, resource.translation]),
)

export const localeLanguages = collectLocaleLanguages()

const appLanguageLabels =
  (translationResources.en?.app_languages as Record<string, unknown> | undefined) ?? {}
const languageLabels =
  (translationResources.en?.languages as Record<string, unknown> | undefined) ?? {}

export const selectableAppLanguages = localeLanguages.filter(
  (language) => language in appLanguageLabels || language in languageLabels,
)
