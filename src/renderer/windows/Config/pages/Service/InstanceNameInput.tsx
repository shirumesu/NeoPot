import { Input } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import ConfigItem from '../../components/ConfigItem'

interface InstanceNameInputProps {
  value: string
  onValueChange: (value: string) => void
  mainWrapperClassName?: string
}

export default function InstanceNameInput({
  value,
  onValueChange,
  mainWrapperClassName = 'max-w-[50%]',
}: InstanceNameInputProps) {
  const { t } = useTranslation()

  return (
    <ConfigItem>
      <Input
        label={t('services.instance_name')}
        labelPlacement="outside-left"
        value={value}
        variant="bordered"
        classNames={{
          base: 'justify-between',
          label: 'text-(length:--heroui-font-size-medium)',
          mainWrapper: mainWrapperClassName,
        }}
        onValueChange={onValueChange}
      />
    </ConfigItem>
  )
}
