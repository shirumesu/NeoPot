import { languageList } from './language'
import { ServiceSourceType, getServiceName, getServiceSouceType } from '../service/service_instance'

type LanguageMap = Record<string, string>

export interface TranslateServiceLanguageSource {
  builtinServices: Record<string, { Language?: LanguageMap }>
  pluginServices: Record<string, { language?: LanguageMap }>
}

function supportedLanguageKeys(languageMap: LanguageMap | undefined): string[] | null {
  if (!languageMap || Object.keys(languageMap).length === 0) {
    return null
  }

  return Object.keys(languageMap).filter((key) => key !== 'auto')
}

export function getSupportedTranslateLanguageList(
  serviceInstanceList: string[],
  source: TranslateServiceLanguageSource,
): string[] {
  if (serviceInstanceList.length === 0) {
    return languageList
  }

  let commonSupported: string[] | null = null

  for (const serviceInstanceKey of serviceInstanceList) {
    const serviceName = getServiceName(serviceInstanceKey)
    const serviceSourceType = getServiceSouceType(serviceInstanceKey)
    const languageKeys =
      serviceSourceType === ServiceSourceType.PLUGIN
        ? supportedLanguageKeys(source.pluginServices[serviceName]?.language)
        : supportedLanguageKeys(source.builtinServices[serviceName]?.Language)

    if (languageKeys === null) {
      continue
    }

    const supported = new Set<string>(languageKeys)
    if (commonSupported === null) {
      commonSupported = languageKeys
    } else {
      commonSupported = commonSupported.filter((language) => supported.has(language))
    }

    if (commonSupported.length === 0) {
      return []
    }
  }

  if (commonSupported === null) {
    return languageList
  }

  const supported = new Set(commonSupported)
  const orderedLanguages = languageList.filter((language) => supported.has(language))
  return orderedLanguages
}
