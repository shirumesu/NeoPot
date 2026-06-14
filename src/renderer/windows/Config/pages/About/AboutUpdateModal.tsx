import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import { useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import { useToastStyle } from '@/renderer/hooks'
import { UpdaterPanel } from '@/renderer/windows/Updater/UpdaterPanel'
import { useUpdaterController } from '@/renderer/windows/Updater/useUpdaterController'

interface AboutUpdateModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export default function AboutUpdateModal({ isOpen, onOpenChange }: AboutUpdateModalProps) {
  const { t } = useTranslation()
  const toastStyle = useToastStyle()
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  const showError = useCallback(
    (message: string) => {
      if (!isOpenRef.current) {
        return
      }

      toast.error(message, { style: toastStyle })
    },
    [toastStyle],
  )
  const controller = useUpdaterController({
    autoCheck: isOpen,
    onError: showError,
  })

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside" size="4xl">
      <ModalContent className="h-[min(760px,86vh)]">
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 pr-10">
              <span>{t('updater.about_title')}</span>
              <span className="text-sm font-normal text-default-500">
                {t('updater.about_description')}
              </span>
            </ModalHeader>
            <ModalBody className="min-h-0 pb-5">
              <UpdaterPanel controller={controller} onCancel={onClose} />
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
