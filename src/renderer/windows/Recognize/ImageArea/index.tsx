import { Card, CardBody, CardFooter, Button, Tooltip } from '@heroui/react'
import { getCurrentWindow } from '@/renderer/lib/electron/window'
import { useCallback, useEffect, useRef } from 'react'
import { onAppEvent } from '@/renderer/lib/electron/events'
import { MdContentCopy } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { invokeCommand } from '@/renderer/lib/electron/command'
import { atom, useAtom } from 'jotai'

import { useConfig } from '../../../hooks'
const appWindow = getCurrentWindow()

export const base64Atom = atom('')
let unlisten: (() => void) | null = null

export default function ImageArea() {
  const [hideWindow] = useConfig('recognize_hide_window', false)
  const [base64, setBase64] = useAtom(base64Atom)
  const imgRef = useRef<HTMLImageElement>(null)
  const { t } = useTranslation()
  const load_img = useCallback(() => {
    invokeCommand('get_base64').then((v) => {
      setBase64(String(v))
      if (hideWindow) {
        appWindow.hide()
      } else {
        appWindow.show()
        appWindow.setFocus(true)
      }
    })
  }, [hideWindow, setBase64])

  useEffect(() => {
    if (hideWindow !== null) {
      load_img()
      if (unlisten) {
        unlisten()
      }
      unlisten = onAppEvent('new_image', () => {
        load_img()
      })
      void window.neoPot.app.rendererReady()
    }
  }, [hideWindow, load_img])

  return (
    <Card shadow="none" className="bg-content1 h-full ml-3 mr-1.5" radius="lg">
      <CardBody className="bg-content1 h-full p-0">
        {base64 !== '' && (
          <img
            ref={imgRef}
            draggable={false}
            className="object-contain h-full w-full"
            src={'data:image/png;base64,' + base64}
          />
        )}
      </CardBody>
      <CardFooter className="bg-content1 flex justify-start px-3">
        <Tooltip content={t('recognize.copy_img')}>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={async () => {
              await invokeCommand('copy_img', {
                width: imgRef.current?.naturalWidth ?? 0,
                height: imgRef.current?.naturalHeight ?? 0,
              })
            }}
          >
            <MdContentCopy className="text-[16px]" />
          </Button>
        </Tooltip>
      </CardFooter>
    </Card>
  )
}
