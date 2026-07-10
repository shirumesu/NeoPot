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
    ['en', 'This is an English sentence for testing language detection.'],
    ['fr', 'Bonjour, ceci est une phrase francaise pour tester la detection.'],
    ['de', 'Guten Morgen, dies ist ein deutscher Satz zur Spracherkennung.'],
    ['es', 'Hola, esta es una frase en espanol para probar la deteccion.'],
    ['it', 'Ciao, questa e una frase italiana per provare il rilevamento.'],
    ['sv', 'Hej, det har ar en svensk mening for att testa sprakigenkanning.'],
    ['pl', 'To jest polskie zdanie do testowania wykrywania jezyka.'],
    ['nl', 'Dit is een Nederlandse zin om taaldetectie te testen.'],
    ['vi', 'Xin chào, đây là một câu tiếng Việt để kiểm tra nhận diện ngôn ngữ.'],
    ['id', 'Ini adalah kalimat bahasa Indonesia untuk menguji deteksi bahasa.'],
    ['tr', 'Merhaba, bu dil algilamayi test etmek icin Turkce bir cumledir.'],
  ]

  for (const [expected, input] of cases) {
    assert.equal(await detectLanguage(input), expected, input)
  }
})

test('local language detection does not let short CJK path fragments override English markdown', async () => {
  const markdown = `# AGENTS.md - User Preferences and Working Rules

## Common Paths

- Obsidian notes: \`D:\\obsidian\\日常\`
- Code projects: \`D:\\program\\project\\{project}\`
- Environment path: \`D:\\program\\env\`. Install reusable tools and environments here whenever possible.

## Core Contract

- Bias toward clear judgment over both speed and excessive caution. Before acting on non-trivial work, state important assumptions, success criteria, and uncertainty that could change the approach.
- Prefer explanations that make the tradeoff understandable, especially when the decision is not obvious.
`

  assert.equal(await detectLanguage(markdown), 'en')
})
