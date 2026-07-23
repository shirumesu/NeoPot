import { describe, expect, it } from 'vitest'
import { getTrayLabels } from '../../src/shared/trayLabels'

describe('tray labels', () => {
  it('uses the configured locale without loading renderer translation bundles', () => {
    expect(getTrayLabels('zh-CN')).toEqual({
      config: '偏好设置',
      selectionTranslate: '划词翻译',
      inputTranslate: '输入翻译',
      ocrRecognize: '文字识别',
      ocrTranslate: '截图翻译',
      restart: '重启',
      quit: '退出',
    })
    expect(getTrayLabels('de_DE').quit).toBe('Beenden')
  })

  it('falls back to English for unknown or invalid locale values', () => {
    expect(getTrayLabels('unknown').quit).toBe('Quit')
    expect(getTrayLabels(null).config).toBe('Preference')
  })
})
