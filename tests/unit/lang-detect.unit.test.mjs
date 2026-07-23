import assert from 'node:assert/strict'
import { test } from 'vitest'

import { detectLanguage } from '../../src/main/modules/lang-detect.ts'

test('local language detection recognizes script-specific languages without remote services', async () => {
  const cases = [
    ['en', ''],
    ['zh_cn', '这是一个用于测试语言检测的简体中文句子。'],
    ['zh_tw', '這是一個用於測試語言偵測的繁體中文句子。'],
    ['ja', 'これは日本語の文章です。'],
    ['ko', '이것은 한국어 문장입니다.'],
    ['ar', 'مرحبا هذا نص عربي لاختبار اكتشاف اللغة.'],
    ['he', 'שלום זה טקסט בעברית לבדיקת זיהוי שפה.'],
    ['hi', 'यह भाषा पहचान की जांच के लिए हिंदी वाक्य है।'],
    ['th', 'นี่คือข้อความภาษาไทยสำหรับทดสอบการตรวจจับภาษา'],
    ['km', 'ខ្ញុំស្រឡាញ់ភាសាខ្មែរ'],
  ]

  for (const [expected, input] of cases) {
    assert.equal(await detectLanguage(input), expected, input)
  }
})

test('local language detection treats kana as a high-confidence Japanese signal', async () => {
  const cases = ['日本語の文章です', '今日は良い天気です', 'これは日本語です']

  for (const input of cases) {
    assert.equal(await detectLanguage(input), 'ja', input)
  }
})

test('local language detection distinguishes Cyrillic languages with script-specific letters', async () => {
  assert.equal(
    await detectLanguage('Это русское предложение для проверки определения языка.'),
    'ru',
  )
  assert.equal(await detectLanguage('Це українське речення для перевірки визначення мови.'), 'uk')
  assert.equal(await detectLanguage('Энэ бол хэл илрүүлэхийг шалгах монгол өгүүлбэр юм.'), 'mn_cy')
})

test('local language detection maps common Latin-family results to NeoPot language keys', async () => {
  const cases = [
    ['en', 'Clouds drift above the quiet harbor while fishermen prepare their boats.'],
    ['fr', 'Le soleil traverse doucement les fenêtres pendant que la ville se réveille.'],
    ['de', 'Heute scheint die Sonne durch das Fenster und der Garten wirkt besonders ruhig.'],
    ['es', 'Los niños juegan junto al río mientras sus familias preparan la cena.'],
    ['it', 'Quando arriva la sera, le luci della città si riflettono sul fiume.'],
    ['sv', 'Fåglarna samlas vid sjön när kvällsluften blir svalare.'],
    ['pl', 'Wczoraj odwiedziliśmy małą księgarnię ukrytą przy rynku.'],
    ['nl', 'Gisteren fietsten we langs de kust terwijl de wind langzaam afnam.'],
    ['vi', 'Buổi sáng mọi người thường đi bộ quanh hồ trước khi làm việc.'],
    ['id', 'Pagi tadi kami berjalan menuju pasar sebelum hujan mulai turun.'],
    ['tr', 'Bugün sahilde yürürken uzakta birkaç küçük tekne gördük.'],
  ]

  for (const [expected, input] of cases) {
    assert.equal(await detectLanguage(input), expected, input)
  }
})

test('local language detection does not let short CJK path fragments override English markdown', async () => {
  const markdown = `# Project Notes

## Paths

- Daily notes: \`notes/日常\`
- Source directory: \`workspace/项目\`

## Working Agreement

- Keep decisions concise and record the assumptions that affect implementation.
- Prefer explanations that make tradeoffs understandable.
`

  assert.equal(await detectLanguage(markdown), 'en')
})
