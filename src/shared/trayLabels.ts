export interface TrayLabels {
  config: string
  selectionTranslate: string
  inputTranslate: string
  ocrRecognize: string
  ocrTranslate: string
  restart: string
  quit: string
}

const labels: Record<string, TrayLabels> = {
  ar: {
    config: 'الإعدادات',
    selectionTranslate: 'ترجمة النص المحدد',
    inputTranslate: 'ترجمة النص',
    ocrRecognize: 'التعرف على النص',
    ocrTranslate: 'ترجمة لقطة الشاشة',
    restart: 'إعادة التشغيل',
    quit: 'خروج',
  },
  de: {
    config: 'Einstellungen',
    selectionTranslate: 'Auswahl übersetzen',
    inputTranslate: 'Text übersetzen',
    ocrRecognize: 'Texterkennung',
    ocrTranslate: 'Screenshot-Übersetzung',
    restart: 'Neustart',
    quit: 'Beenden',
  },
  en: {
    config: 'Preference',
    selectionTranslate: 'Selection Translation',
    inputTranslate: 'Input Translation',
    ocrRecognize: 'Text Recognition',
    ocrTranslate: 'Screenshot Translation',
    restart: 'Restart',
    quit: 'Quit',
  },
  es: {
    config: 'Preferencias',
    selectionTranslate: 'Traducir selección',
    inputTranslate: 'Traducir texto',
    ocrRecognize: 'Reconocer texto',
    ocrTranslate: 'Traducir captura',
    restart: 'Reiniciar',
    quit: 'Salir',
  },
  fr: {
    config: 'Préférences',
    selectionTranslate: 'Traduire la sélection',
    inputTranslate: 'Traduire le texte',
    ocrRecognize: 'Reconnaître le texte',
    ocrTranslate: 'Traduire la capture',
    restart: 'Redémarrer',
    quit: 'Quitter',
  },
  ja: {
    config: '設定',
    selectionTranslate: '選択テキスト翻訳',
    inputTranslate: '入力翻訳',
    ocrRecognize: 'テキスト認識',
    ocrTranslate: 'スクリーンショット翻訳',
    restart: '再起動',
    quit: '終了',
  },
  ko: {
    config: '환경 설정',
    selectionTranslate: '선택 텍스트 번역',
    inputTranslate: '입력 번역',
    ocrRecognize: '텍스트 인식',
    ocrTranslate: '스크린샷 번역',
    restart: '다시 시작',
    quit: '종료',
  },
  pt_br: {
    config: 'Preferências',
    selectionTranslate: 'Traduzir seleção',
    inputTranslate: 'Traduzir texto',
    ocrRecognize: 'Reconhecer texto',
    ocrTranslate: 'Traduzir captura',
    restart: 'Reiniciar',
    quit: 'Sair',
  },
  ru: {
    config: 'Настройки',
    selectionTranslate: 'Перевод выделенного',
    inputTranslate: 'Перевод текста',
    ocrRecognize: 'Распознавание текста',
    ocrTranslate: 'Перевод скриншота',
    restart: 'Перезапустить',
    quit: 'Выход',
  },
  tr: {
    config: 'Ayarlar',
    selectionTranslate: 'Seçili metni çevir',
    inputTranslate: 'Metin çevirisi',
    ocrRecognize: 'Metin tanıma',
    ocrTranslate: 'Ekran görüntüsü çevirisi',
    restart: 'Yeniden başlat',
    quit: 'Çık',
  },
  zh_cn: {
    config: '偏好设置',
    selectionTranslate: '划词翻译',
    inputTranslate: '输入翻译',
    ocrRecognize: '文字识别',
    ocrTranslate: '截图翻译',
    restart: '重启',
    quit: '退出',
  },
  zh_tw: {
    config: '偏好設定',
    selectionTranslate: '選取文字翻譯',
    inputTranslate: '輸入翻譯',
    ocrRecognize: '文字辨識',
    ocrTranslate: '螢幕截圖翻譯',
    restart: '重新啟動',
    quit: '結束',
  },
}

export function getTrayLabels(language: unknown): TrayLabels {
  const normalized =
    typeof language === 'string' ? language.trim().toLowerCase().replace(/-/gu, '_') : 'en'
  return labels[normalized] ?? labels[normalized.split('_')[0]] ?? labels.en
}
