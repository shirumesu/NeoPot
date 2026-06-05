import { Button, Input } from '@heroui/react'
import React from 'react'

import ConfigItem from '../ConfigItem'

export type HotkeySetter = (value: string, sync?: boolean) => Promise<void>

type HotkeyFieldProps = {
  title: React.ReactNode
  name: string
  value: string | null
  setValue: HotkeySetter
  inputLabel: string
  okLabel: string
  onKeyDown: (event: React.KeyboardEvent, name: string, setValue: HotkeySetter) => void
  onConfirm: (name: string, value: string, setValue: HotkeySetter) => void
}

export default function HotkeyField({
  title,
  name,
  value,
  setValue,
  inputLabel,
  okLabel,
  onKeyDown,
  onConfirm,
}: HotkeyFieldProps) {
  return (
    <ConfigItem title={title}>
      {value !== null && (
        <Input
          type="hotkey"
          variant="bordered"
          value={value}
          label={inputLabel}
          className="max-w-[60%]"
          onKeyDown={(event) => {
            onKeyDown(event, name, setValue)
          }}
          endContent={
            <Button
              size="sm"
              variant="flat"
              className={value === '' ? 'hidden' : ''}
              onPress={() => {
                onConfirm(name, value, setValue)
              }}
            >
              {okLabel}
            </Button>
          }
        />
      )}
    </ConfigItem>
  )
}
