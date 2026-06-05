import { useNavigate, useLocation } from 'react-router-dom'
import { BsInfoSquareFill } from 'react-icons/bs'
import { PiTranslateFill } from 'react-icons/pi'
import { AiFillAppstore } from 'react-icons/ai'
import { useTranslation } from 'react-i18next'
import { PiTextboxFill } from 'react-icons/pi'
import { MdExtension, MdKeyboardAlt, MdMiscellaneousServices } from 'react-icons/md'
import { Button } from '@heroui/react'
import type { IconType } from 'react-icons'
import React from 'react'

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

  function setStyle(pathname: string): 'flat' | 'light' {
    return location.pathname.includes(pathname) ? 'flat' : 'light'
  }

  return (
    <div className="mx-3 overflow-y-auto">
      {sideBarItems.map((item) => {
        const Icon = item.icon

        return (
          <Button
            key={item.path}
            fullWidth
            size="lg"
            variant={setStyle(item.path)}
            className="mb-1.25"
            onPress={() => {
              navigate(item.path)
            }}
            startContent={<Icon className="text-[24px]" />}
          >
            <div className="w-full">{t(item.label)}</div>
          </Button>
        )
      })}
    </div>
  )
}
