import { useNavigate, useLocation } from 'react-router-dom'
import { BsInfoSquareFill } from 'react-icons/bs'
import { PiTranslateFill } from 'react-icons/pi'
import { AiFillAppstore } from 'react-icons/ai'
import { useTranslation } from 'react-i18next'
import { PiTextboxFill } from 'react-icons/pi'
import { MdExtension, MdKeyboardAlt, MdMiscellaneousServices } from 'react-icons/md'
import { Button } from '@heroui/react'
import type { IconType } from 'react-icons'

const sideBarItems: Array<{
  path: string
  label: string
  icon: IconType
}> = [
  { path: '/general', label: 'config.general.label', icon: AiFillAppstore },
  { path: '/translate', label: 'config.translate.label', icon: PiTranslateFill },
  { path: '/recognize', label: 'config.recognize.label', icon: PiTextboxFill },
  { path: '/hotkey', label: 'config.hotkey.label', icon: MdKeyboardAlt },
  { path: '/service', label: 'config.service.label', icon: MdMiscellaneousServices },
  { path: '/plugin', label: 'config.plugin.label', icon: MdExtension },
  { path: '/about', label: 'config.about.label', icon: BsInfoSquareFill },
]

export default function SideBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav aria-label={t('windows.config')} className="mx-3 overflow-y-auto">
      {sideBarItems.map((item) => {
        const Icon = item.icon
        const isCurrent = location.pathname === item.path

        return (
          <Button
            key={item.path}
            aria-current={isCurrent ? 'page' : undefined}
            fullWidth
            size="lg"
            variant={isCurrent ? 'flat' : 'light'}
            className="mb-1.25"
            onPress={() => {
              navigate(item.path)
            }}
            startContent={<Icon aria-hidden="true" className="text-[24px]" />}
          >
            <div className="w-full">{t(item.label)}</div>
          </Button>
        )
      })}
    </nav>
  )
}
