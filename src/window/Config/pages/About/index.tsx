// @ts-nocheck
import { Divider, Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@/utils/electron_compat/core'
import React from 'react'

import { appVersion } from '../../../../utils/env'

export default function About() {
  const { t } = useTranslation()
  const showComingSoon = () => {
    window.alert(t('common.coming'))
  }

  return (
    <div className="h-full w-full py-[80px] px-[100px]">
      <img src="icon.png" className="mx-auto h-[100px] mb-[5px]" draggable={false} />
      <div className="content-center">
        <h1 className="font-bold text-2xl text-center">NeoPot</h1>
        <p className="text-center text-sm text-gray-500 mb-[5px]">{appVersion}</p>
        <Divider />
        <div className="flex justify-between">
          <Button
            variant="light"
            className="my-[5px]"
            size="sm"
            onPress={() => {
              showComingSoon()
            }}
          >
            {t('config.about.website')}
          </Button>
          <Button
            variant="light"
            className="my-[5px]"
            size="sm"
            onPress={() => {
              invoke('open_url', { url: 'https://github.com/shirumesu/NeoPot' })
            }}
          >
            {t('config.about.github')}
          </Button>
          <Popover placement="top" offset={10}>
            <PopoverTrigger>
              <Button variant="light" className="my-[5px]" size="sm">
                {t('config.about.feedback')}
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="flex justify-between">
                <Button
                  variant="light"
                  className="my-[5px]"
                  size="sm"
                  onPress={() => {
                    invoke('open_url', { url: 'https://github.com/shirumesu/NeoPot/issues' })
                  }}
                >
                  {t('config.about.issue')}
                </Button>
                <Button
                  variant="light"
                  className="my-[5px]"
                  size="sm"
                  onPress={() => {
                    showComingSoon()
                  }}
                >
                  {t('config.about.email')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="light"
            className="my-[5px]"
            size="sm"
            onPress={() => {
              showComingSoon()
            }}
          >
            {t('config.about.community')}
          </Button>
        </div>
        <Divider />
      </div>
      <div className="content-center px-[40px]">
        <div className="flex justify-between">
          <Button
            variant="light"
            className="my-[5px]"
            size="sm"
            onPress={() => {
              invoke('updater_window')
            }}
          >
            {t('config.about.check_update')}
          </Button>
          <Button
            variant="light"
            className="my-[5px]"
            size="sm"
            onPress={async () => {
              await invoke('open_log_dir')
            }}
          >
            {t('config.about.view_log')}
          </Button>
          <Button
            variant="light"
            className="my-[5px]"
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
