import {
  Input,
  Button,
  Switch,
  Textarea,
  Card,
  CardBody,
  Link,
  Tooltip,
  Progress,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react'
import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { MdDeleteOutline } from 'react-icons/md'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useConfig } from '../../../hooks/useConfig'
import { getModels as getOllamaModels, pullModel as pullOllamaModel, translate } from './index'
import { Language } from './index'
import { DEFAULT_OLLAMA_URL, normalizeOllamaBaseUrl } from '@/shared/providerUrl'
import type { ServiceConfigComponentProps } from '@/renderer/windows/Config/pages/Service/types'
import ProviderConfigForm from '@/renderer/windows/Config/pages/Service/ProviderConfigForm'
import TestButton from '@/renderer/windows/Config/pages/Service/TestButton'
import InstanceNameInput from '@/renderer/windows/Config/pages/Service/InstanceNameInput'
import ConfigItem from '@/renderer/windows/Config/components/ConfigItem'
import {
  DEFAULT_MODEL,
  LEGACY_DEFAULT_MODEL,
  THINKING_MODE_DEFAULT,
  THINKING_MODE_OFF,
  THINKING_MODE_ON,
} from './constants'

const DEFAULT_PROMPT_LIST = [
  {
    role: 'system',
    content:
      'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
  },
  { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
]

type PromptItem = {
  role: string
  content: string
}

type OllamaServiceConfig = {
  [INSTANCE_NAME_CONFIG_KEY]: string
  stream: boolean
  model: string
  requestPath: string
  temperature: string
  topP: string
  topK: string
  thinkingMode: string
  promptList: PromptItem[]
}

type OllamaModelList = {
  models?: { name: string }[]
}

function normalizeServiceConfig(config: OllamaServiceConfig): OllamaServiceConfig {
  return {
    ...config,
    promptList: config.promptList ?? DEFAULT_PROMPT_LIST,
    temperature: config.temperature ?? '',
    topP: config.topP ?? '',
    topK: config.topK ?? '',
    thinkingMode: config.thinkingMode ?? THINKING_MODE_DEFAULT,
  }
}

export function Config(props: ServiceConfigComponentProps) {
  const { instanceKey, updateServiceList, onClose } = props
  const { t } = useTranslation()
  const [storedServiceConfig, setServiceConfig] = useConfig<OllamaServiceConfig>(
    instanceKey,
    {
      [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.ollama.title'),
      stream: true,
      model: DEFAULT_MODEL,
      requestPath: DEFAULT_OLLAMA_URL,
      temperature: '',
      topP: '',
      topK: '',
      thinkingMode: THINKING_MODE_OFF,
      promptList: DEFAULT_PROMPT_LIST,
    },
    { sync: false },
  )
  const serviceConfig =
    storedServiceConfig === null ? null : normalizeServiceConfig(storedServiceConfig)
  const [isLoading, setIsLoading] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [pullingStatus, setPullingStatus] = useState('')
  const [installedModels, setInstalledModels] = useState<OllamaModelList | null>(null)
  const serviceConfigRef = useRef(serviceConfig)

  useEffect(() => {
    serviceConfigRef.current = serviceConfig
  }, [serviceConfig])

  const getModels = useCallback(
    async (currentConfig: OllamaServiceConfig | null = serviceConfigRef.current) => {
      if (currentConfig === null) {
        return
      }

      try {
        const list = await getOllamaModels(normalizeOllamaBaseUrl(currentConfig.requestPath))
        setInstalledModels(list)
        const models = list.models?.map((model: { name: string }) => model.name) ?? []
        if (
          currentConfig.model === LEGACY_DEFAULT_MODEL &&
          models.length > 0 &&
          !models.includes(LEGACY_DEFAULT_MODEL)
        ) {
          setServiceConfig({
            ...currentConfig,
            model: models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0],
          })
        }
      } catch {
        setInstalledModels(null)
      }
    },
    [setServiceConfig],
  )

  async function pullModel() {
    if (serviceConfig === null) {
      return
    }

    const currentConfig = serviceConfig
    setIsPulling(true)
    setPullingStatus(currentConfig.model)
    try {
      await pullOllamaModel(normalizeOllamaBaseUrl(currentConfig.requestPath), currentConfig.model)
      await getModels(currentConfig)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setPullingStatus('')
      setIsPulling(false)
    }
  }

  useEffect(() => {
    if (serviceConfigRef.current === null) {
      return undefined
    }

    const timeout = setTimeout(() => {
      void getModels()
    }, 400)
    return () => clearTimeout(timeout)
  }, [getModels, serviceConfig?.requestPath])

  return (
    serviceConfig !== null && (
      <ProviderConfigForm
        instanceKey={instanceKey}
        config={serviceConfig}
        setConfig={setServiceConfig}
        updateServiceList={updateServiceList}
        onClose={onClose}
        isLoading={isLoading}
        testButton={
          <TestButton
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            onTest={() =>
              translate('hello', Language.auto, Language.zh_cn, {
                config: serviceConfig,
              })
            }
          />
        }
      >
        <InstanceNameInput
          value={serviceConfig[INSTANCE_NAME_CONFIG_KEY]}
          onValueChange={(value) => {
            void setServiceConfig({
              ...serviceConfig,
              [INSTANCE_NAME_CONFIG_KEY]: value,
            })
          }}
        />
        {installedModels === null && (
          <Card isBlurred className="border-none bg-danger/20 dark:bg-danger/10" shadow="sm">
            <CardBody>
              <div>
                {t('services.translate.ollama.install_ollama')}
                <br />
                <Link isExternal href="https://ollama.com/download" color="primary">
                  {t('services.translate.ollama.install_ollama_link')}
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
        <ConfigItem>
          <Switch
            isSelected={serviceConfig['stream']}
            onValueChange={(value) => {
              setServiceConfig({
                ...serviceConfig,
                stream: value,
              })
            }}
            classNames={{
              base: 'flex flex-row-reverse justify-between w-full max-w-full',
            }}
          >
            {t('services.translate.ollama.stream')}
          </Switch>
        </ConfigItem>
        <ConfigItem>
          <Input
            label={t('services.translate.ollama.request_path')}
            labelPlacement="outside-left"
            value={serviceConfig['requestPath']}
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[50%]',
            }}
            onValueChange={(value) => {
              setServiceConfig({
                ...serviceConfig,
                requestPath: value,
              })
            }}
          />
        </ConfigItem>
        <ConfigItem>
          <Input
            label={t('services.translate.ollama.model')}
            labelPlacement="outside-left"
            value={serviceConfig['model']}
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[50%]',
            }}
            onValueChange={(value) => {
              setServiceConfig({
                ...serviceConfig,
                model: value,
              })
            }}
            endContent={
              installedModels &&
              !installedModels.models
                ?.map((model: { name: string }) => {
                  return model.name
                })
                .includes(serviceConfig['model']) ? (
                <Tooltip content={t('services.translate.ollama.not_installed')}>
                  <Button
                    size="sm"
                    variant="flat"
                    color="warning"
                    isLoading={isPulling}
                    onPress={pullModel}
                  >
                    {t('services.translate.ollama.install_model')}
                  </Button>
                </Tooltip>
              ) : (
                <Button size="sm" variant="flat" color="success" disabled>
                  {t('services.translate.ollama.ready')}
                </Button>
              )
            }
          />
        </ConfigItem>
        <h3 className="my-auto">{t('services.translate.ollama.advanced_options')}</h3>
        <p className="text-[10px] text-default-700">
          {t('services.translate.ollama.advanced_description')}
        </p>
        <ConfigItem title={t('services.translate.ollama.thinking_mode')}>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered">
                {t(`services.translate.ollama.thinking_${serviceConfig.thinkingMode}`)}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              autoFocus="first"
              aria-label={t('accessibility.thinking_mode')}
              onAction={(key) => {
                setServiceConfig({
                  ...serviceConfig,
                  thinkingMode: String(key),
                })
              }}
            >
              <DropdownItem key={THINKING_MODE_DEFAULT}>
                {t('services.translate.ollama.thinking_default')}
              </DropdownItem>
              <DropdownItem key={THINKING_MODE_OFF}>
                {t('services.translate.ollama.thinking_off')}
              </DropdownItem>
              <DropdownItem key={THINKING_MODE_ON}>
                {t('services.translate.ollama.thinking_on')}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </ConfigItem>
        <ConfigItem>
          <Input
            label={t('services.translate.ollama.temperature')}
            labelPlacement="outside-left"
            type="number"
            step="any"
            value={serviceConfig['temperature']}
            placeholder={t('services.translate.ollama.use_model_default')}
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[50%]',
            }}
            onValueChange={(value) => {
              setServiceConfig({
                ...serviceConfig,
                temperature: value,
              })
            }}
          />
        </ConfigItem>
        <ConfigItem>
          <Input
            label={t('services.translate.ollama.top_p')}
            labelPlacement="outside-left"
            type="number"
            step="any"
            value={serviceConfig['topP']}
            placeholder={t('services.translate.ollama.use_model_default')}
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[50%]',
            }}
            onValueChange={(value) => {
              setServiceConfig({
                ...serviceConfig,
                topP: value,
              })
            }}
          />
        </ConfigItem>
        <ConfigItem>
          <Input
            label={t('services.translate.ollama.top_k')}
            labelPlacement="outside-left"
            type="number"
            step="1"
            value={serviceConfig['topK']}
            placeholder={t('services.translate.ollama.use_model_default')}
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[50%]',
            }}
            onValueChange={(value) => {
              setServiceConfig({
                ...serviceConfig,
                topK: value,
              })
            }}
          />
        </ConfigItem>
        <Card isBlurred className="border-none bg-success/20 dark:bg-success/10" shadow="sm">
          <CardBody>
            {isPulling && (
              <Progress
                size="sm"
                radius="sm"
                classNames={{
                  base: 'max-w-md',
                  track: 'drop-shadow-md border border-default',
                  indicator: 'bg-linear-to-r from-pink-500 to-yellow-500',
                  label: 'tracking-wider font-medium text-default-600',
                  value: 'text-foreground/60',
                }}
                label={pullingStatus}
                isIndeterminate
              />
            )}
            <div className="flex justify-center">
              <Link isExternal href="https://ollama.com/library" color="primary">
                {t('services.translate.ollama.supported_models')}
              </Link>
            </div>
          </CardBody>
        </Card>
        <h3 className="my-auto">{t('services.translate.ollama.prompt_list')}</h3>
        <p className="text-[10px] text-default-700">
          {t('services.translate.ollama.prompt_description')}
        </p>

        <div className="bg-content2 rounded-[10px] p-3">
          {serviceConfig.promptList &&
            serviceConfig.promptList.map((prompt, index) => {
              return (
                <ConfigItem key={`${prompt.role}-${index}`}>
                  <Textarea
                    label={prompt.role}
                    labelPlacement="outside"
                    variant="faded"
                    value={prompt.content}
                    placeholder={t('services.translate.ollama.prompt_placeholder', {
                      role: prompt.role,
                    })}
                    onValueChange={(value) => {
                      setServiceConfig({
                        ...serviceConfig,
                        promptList: serviceConfig.promptList.map((p, i) => {
                          if (i === index) {
                            if (i === 0) {
                              return {
                                role: 'system',
                                content: value,
                              }
                            } else {
                              return {
                                role: index % 2 !== 0 ? 'user' : 'assistant',
                                content: value,
                              }
                            }
                          } else {
                            return p
                          }
                        }),
                      })
                    }}
                  />
                  <Button
                    isIconOnly
                    color="danger"
                    className="my-auto mx-1"
                    variant="flat"
                    onPress={() => {
                      setServiceConfig({
                        ...serviceConfig,
                        promptList: serviceConfig.promptList.filter((_, i) => i !== index),
                      })
                    }}
                  >
                    <MdDeleteOutline className="text-[18px]" />
                  </Button>
                </ConfigItem>
              )
            })}
          <Button
            fullWidth
            onPress={() => {
              setServiceConfig({
                ...serviceConfig,
                promptList: [
                  ...serviceConfig.promptList,
                  {
                    role:
                      serviceConfig.promptList.length === 0
                        ? 'system'
                        : serviceConfig.promptList.length % 2 === 0
                          ? 'assistant'
                          : 'user',
                    content: '',
                  },
                ],
              })
            }}
          >
            {t('services.translate.ollama.add')}
          </Button>
        </div>
        <br />
      </ProviderConfigForm>
    )
  )
}
