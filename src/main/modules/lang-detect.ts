import { detectAll as tinyldDetectAll } from 'tinyld'

const languageMap: Record<string, string> = {
  zh: 'zh_cn',
  cmn: 'zh_cn',
  ja: 'ja',
  jpn: 'ja',
  ko: 'ko',
  kor: 'ko',
  en: 'en',
  fr: 'fr',
  es: 'es',
  de: 'de',
  ru: 'ru',
  pt: 'pt_pt',
  tr: 'tr',
  ar: 'ar',
  vi: 'vi',
  th: 'th',
  id: 'id',
  ms: 'ms',
  hi: 'hi',
  mn: 'mn_cy',
  mon: 'mn_cy',
  no: 'nb_no',
  nob: 'nb_no',
  nb: 'nb_no',
  nn: 'nn_no',
  nno: 'nn_no',
  fa: 'fa',
  fas: 'fa',
  pes: 'fa',
  uk: 'uk',
  it: 'it',
  sv: 'sv',
  pl: 'pl',
  nl: 'nl',
  he: 'he',
  heb: 'he',
  km: 'km',
  khm: 'km',
}

const supportedTinyldLanguages = Object.keys(languageMap)

const traditionalChineseCharacters = new Set(
  [
    '繁體臺灣香港萬與專為麼義樂書買亂雲億價優會兒內凍劃劇劉勞區協參雙發變嘗圍園圖團',
    '塊壓壞壯聲夢夠夾奧婦嬰學寶實寫寬對尋導層嶼嶺幣幫廠廣彈強後徑從復徵恆',
    '愛慣慶憂憶懷戰戲戶拋捨掃掛採揀揮損搖撐撥撫據擁擇擊擋擔擴擺擾攜攝敵斷',
    '時曉會術機權來條東楊極構槍樂樓標樣樹橋橫檔檢欄歐歲歷歸殘毀氣決況淚淨',
    '淺漢漲漸漿潛潤潰澀濁濃濕濟濤濫灣災為無煉煙煩燈燒營爐爛牆獨獲獸現瑪',
    '瑤畫異當疊療發盜盡監盤眾睜瞭矯確碼礎禮種稱窮竄竅競筆節範築簡簽籃籌',
    '籠籤粵糾紀約紅紋納紐純紙級紛細終組結絕給統絲經綠維綱網綴綿緊線緝緞締',
    '編緩緯練縣縫縮總績織繕繞繡繪繫繼續纏纖罰罵罷羅義習翹聖聞聯聰聲聽職',
    '肅脫腦腳腸膚膠膽臉臨臺興舊艱艷莊華萬葉著葦蒼蓋蓮蔣蔥蕭薩藍藝藥蘇蘋',
    '蘭處虛號虧蟲蠅術衛補裝裡製複見規視親覺覽訂計訊訓記訟設許訴診詐詞試',
    '詩話該詳誠誤說誰課調請諸諾謀謂謙講謝謠證識譯議護讀變讓讚豐豬貓貝負',
    '財貨責貴買費貼貿賀賓賜賞賠賢賣質賬賭賴購贈贊贏趙趕跡踐車軍軟載較輔',
    '輕輛輪輸辦辭農這連進運過達違遙遞遠適遲遷選遺還邊郵鄉鄧鄭鄰醫釋釐針',
    '釣鈴銀銅銘銳銷鋁鋒鋼錄錢錦錯鍋鍛鍵鎖鎮鏡鐵鑄長門開間閣關闆闊闖隊階',
    '險隨隱雙雜雞離難雲電靈靜響頁頂順須頌預領頭頰頸頻顆題額顏願類顧顯風',
    '飛飯飲飾餅餘館饋饑馬馳駕駛駝駭駱騎騙騰驚驗髒體鬆鬥魚鮮鳥鳴鴨鴻鵝',
    '鵬鶴鷹鹽麗麥黃點黨齊齒龍',
  ].join(''),
)

const scriptDetectors: Array<{ language: string; pattern: RegExp }> = [
  { language: 'ja', pattern: /[\u3040-\u30ff]/u },
  { language: 'ko', pattern: /[\uac00-\ud7af]/u },
  { language: 'ar', pattern: /[\u0600-\u06ff]/u },
  { language: 'he', pattern: /[\u0590-\u05ff]/u },
  { language: 'hi', pattern: /[\u0900-\u097f]/u },
  { language: 'th', pattern: /[\u0e00-\u0e7f]/u },
  { language: 'km', pattern: /[\u1780-\u17ff]/u },
  { language: 'zh_cn', pattern: /[\u4e00-\u9fff]/u },
]

const scriptCharacterPatterns: Record<string, RegExp> = {
  ja: /[\u3040-\u30ff]/gu,
  ko: /[\uac00-\ud7af]/gu,
  ar: /[\u0600-\u06ff]/gu,
  he: /[\u0590-\u05ff]/gu,
  hi: /[\u0900-\u097f]/gu,
  th: /[\u0e00-\u0e7f]/gu,
  km: /[\u1780-\u17ff]/gu,
  zh_cn: /[\u4e00-\u9fff]/gu,
}

const cyrillicLanguagePatterns: Array<{ language: string; pattern: RegExp }> = [
  { language: 'uk', pattern: /[іїєґІЇЄҐ]/u },
  { language: 'mn_cy', pattern: /[өӨүҮ]/u },
  { language: 'ru', pattern: /[ёъыэЁЪЫЭ]/u },
]

const latinFeaturePatterns: Array<{ language: string; pattern: RegExp }> = [
  {
    language: 'fr',
    pattern: /[àâæçéèêëîïôœùûüÿ]|(?:\b(?:bonjour|merci|fran[cç]ais|est|une?|des?|pour|avec)\b)/iu,
  },
  { language: 'es', pattern: /[áéíñóúü¿¡]|(?:\b(?:hola|esta|espa[nñ]ol|para|con|una?)\b)/iu },
  { language: 'de', pattern: /[äöüß]|(?:\b(?:guten|morgen|deutsch(?:er|e)?|dies|ist|zur)\b)/iu },
  {
    language: 'pt_pt',
    pattern: /[ãõçáâéêíóôú]|(?:\b(?:ol[áa]|portugu[eê]s|brasil|portugal|para|com)\b)/iu,
  },
  { language: 'it', pattern: /[àèéìòù]|(?:\b(?:ciao|questa?|italian[ao]|per|con)\b)/iu },
  { language: 'tr', pattern: /[çğıİöşü]|(?:\b(?:merhaba|t[uü]rk[cç]e|icin|i[cç]in|dil)\b)/iu },
  { language: 'sv', pattern: /[åäö]|(?:\b(?:hej|svensk[at]?|det|att|spr[aå]k)\b)/iu },
  {
    language: 'pl',
    pattern: /[ąćęłńóśźż]|(?:\b(?:polsk(?:ie|i|a)|jest|zdanie|jezyka|języka)\b)/iu,
  },
  { language: 'nl', pattern: /(?:\b(?:nederlandse?|taal|zin|dit|een|het|om)\b)/iu },
  {
    language: 'vi',
    pattern: /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu,
  },
  {
    language: 'id',
    pattern: /(?:\b(?:bahasa indonesia|selamat|adalah|untuk|menguji|kalimat|ini)\b)/iu,
  },
]

function hasTraditionalChineseSignal(value: string) {
  for (const character of value) {
    if (traditionalChineseCharacters.has(character)) {
      return true
    }
  }

  return false
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0
}

function hasEnoughScriptSignal(scriptCharacterCount: number, latinLetterCount: number) {
  if (scriptCharacterCount === 0) {
    return false
  }
  if (latinLetterCount < 20) {
    return true
  }

  return scriptCharacterCount >= 4 && scriptCharacterCount / latinLetterCount >= 0.05
}

function detectByScript(value: string): string | null {
  const latinLetterCount = countMatches(value, /[A-Za-z]/g)

  for (const { language, pattern } of scriptDetectors) {
    if (!pattern.test(value)) {
      continue
    }

    if (
      !hasEnoughScriptSignal(
        countMatches(value, scriptCharacterPatterns[language] ?? pattern),
        latinLetterCount,
      )
    ) {
      continue
    }

    if (language === 'zh_cn') {
      return hasTraditionalChineseSignal(value) ? 'zh_tw' : 'zh_cn'
    }

    return language
  }

  return null
}

function detectCyrillic(value: string): string | null {
  if (!/[\u0400-\u04ff]/u.test(value)) {
    return null
  }

  for (const { language, pattern } of cyrillicLanguagePatterns) {
    if (pattern.test(value)) {
      return language
    }
  }

  return null
}

function detectByLatinFeatures(value: string): string | null {
  for (const { language, pattern } of latinFeaturePatterns) {
    if (pattern.test(value)) {
      return language
    }
  }

  return null
}

function mapDetectedLanguage(detected: string | undefined) {
  if (!detected) {
    return null
  }

  return languageMap[detected] ?? null
}

export async function detectLanguage(text: string): Promise<string> {
  const value = text.trim()
  if (!value) {
    return 'en'
  }

  const scriptLanguage = detectByScript(value)
  if (scriptLanguage) return scriptLanguage

  const cyrillicLanguage = detectCyrillic(value)
  if (cyrillicLanguage) return cyrillicLanguage

  const candidates = tinyldDetectAll(value, { only: supportedTinyldLanguages })
  const [best, second] = candidates
  const mappedBest = mapDetectedLanguage(best?.lang)
  if (mappedBest && (best.accuracy >= 0.12 || best.accuracy - (second?.accuracy ?? 0) >= 0.04)) {
    return mappedBest
  }

  return detectByLatinFeatures(value) ?? mappedBest ?? 'en'
}
