import { Divider, Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@/renderer/lib/electron/compat/core'
import React from 'react'

import { appVersion } from '@/renderer/lib/config/env'

export default function About() {
  const { t } = useTranslation()

  return (
    <div className="h-full w-full px-6 py-12 sm:px-12 sm:py-16">
      <img src="icon.png" className="mx-auto mb-1.5 h-24" draggable={false} />
      <div className="mx-auto max-w-md">
        <h1 className="font-bold text-2xl text-center">NeoPot</h1>
        <p className="text-center text-sm text-gray-500 mb-1.5">{appVersion}</p>
        <Divider />
        <div className="flex justify-between">
          <Popover placement="top" offset={10}>
            <PopoverTrigger>
              <Button variant="light" className="my-1.5" size="sm">
                {t('config.about.website')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-2">
              <div className="text-sm text-gray-600">{t('common.coming')}</div>
            </PopoverContent>
          </Popover>
          <Button
            variant="light"
            className="my-1.5"
            size="sm"
            onPress={() => {
              invoke('open_url', { url: 'https://github.com/shirumesu/NeoPot' })
            }}
          >
            {t('config.about.github')}
          </Button>
          <Popover placement="top" offset={10}>
            <PopoverTrigger>
              <Button variant="light" className="my-1.5" size="sm">
                {t('config.about.feedback')}
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="flex justify-between gap-2 p-2">
                <Button
                  variant="light"
                  size="sm"
                  onPress={() => {
                    invoke('open_url', { url: 'https://github.com/shirumesu/NeoPot/issues' })
                  }}
                >
                  {t('config.about.issue')}
                </Button>
                <Popover placement="top" offset={10}>
                  <PopoverTrigger>
                    <Button variant="light" size="sm">
                      {t('config.about.email')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2">
                    <div className="text-sm text-gray-600">{t('common.coming')}</div>
                  </PopoverContent>
                </Popover>
              </div>
            </PopoverContent>
          </Popover>

          <Popover placement="top" offset={10}>
            <PopoverTrigger>
              <Button variant="light" className="my-1.5" size="sm">
                {t('config.about.community')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-2">
              <div className="text-sm text-gray-600">{t('common.coming')}</div>
            </PopoverContent>
          </Popover>
        </div>
        <Divider />
      </div>
      <div className="mx-auto max-w-sm px-0 sm:px-10">
        <div className="flex justify-between">
          <Button
            variant="light"
            className="my-1.5"
            size="sm"
            onPress={() => {
              invoke('updater_window')
            }}
          >
            {t('config.about.check_update')}
          </Button>
          <Button
            variant="light"
            className="my-1.5"
            size="sm"
            onPress={async () => {
              await invoke('open_log_dir')
            }}
          >
            {t('config.about.view_log')}
          </Button>
          <Button
            variant="light"
            className="my-1.5"
            size="sm"
            onPress={async () => {
              await invoke('open_config_dir')
            }}
          >
            {t('config.about.view_config')}
          </Button>
        </div>

        <Divider />
      </div>
    </div>
  )
}
