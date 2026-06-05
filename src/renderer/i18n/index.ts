import { initReactI18next } from 'react-i18next'
import i18n from 'i18next'
import { i18nResources } from './resources'

// http://www.lingoes.net/zh/translator/langcode.htm

i18n.use(initReactI18next).init({
  fallbackLng: {
    zh_tw: ['zh_cn', 'en'],
    zh_cn: ['zh_tw', 'en'],
    default: ['en'],
  },
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  resources: i18nResources,
})

export default i18n
