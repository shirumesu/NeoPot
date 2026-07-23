import { invoke_plugin } from '@/renderer/lib/plugin/invoke_plugin'
import type { TranslateProvider } from '@/renderer/providers/translate'
import type { InstalledPlugin } from '@/renderer/windows/Config/pages/Plugin/installedPlugins'
import { getServiceName, whetherPluginService } from './service_instance'

export type TranslateServiceInvocationErrorCode =
  | 'service-not-configured'
  | 'language-not-supported'

export class TranslateServiceInvocationError extends Error {
  constructor(readonly code: TranslateServiceInvocationErrorCode) {
    super(code)
    this.name = 'TranslateServiceInvocationError'
  }
}

type PluginInvoker = typeof invoke_plugin

interface InvokeTranslateServiceOptions {
  instanceKey: string
  text: string
  from: string
  to: string
  detect: string
  serviceInstanceConfigMap: Record<string, Record<string, unknown>>
  pluginServices: Record<string, InstalledPlugin>
  builtinServices: Record<string, TranslateProvider>
  onStream: (value: unknown) => void
  invokePlugin?: PluginInvoker
}

export async function invokeTranslateService({
  instanceKey,
  text,
  from,
  to,
  detect,
  serviceInstanceConfigMap,
  pluginServices,
  builtinServices,
  onStream,
  invokePlugin = invoke_plugin,
}: InvokeTranslateServiceOptions): Promise<unknown> {
  const serviceName = getServiceName(instanceKey)

  if (whetherPluginService(instanceKey)) {
    const plugin = pluginServices[serviceName]
    if (!plugin?.language) {
      throw new TranslateServiceInvocationError('service-not-configured')
    }
    if (!(from in plugin.language) || !(to in plugin.language)) {
      throw new TranslateServiceInvocationError('language-not-supported')
    }

    const instanceConfig = serviceInstanceConfigMap[instanceKey]
    if (!instanceConfig) {
      throw new TranslateServiceInvocationError('service-not-configured')
    }

    const [translate, utils] = await invokePlugin('translate', serviceName)
    return translate(text, plugin.language[from], plugin.language[to], {
      config: { ...instanceConfig, enable: true },
      detect,
      setResult: onStream,
      utils,
    })
  }

  const service = builtinServices[serviceName]
  if (!service) {
    throw new TranslateServiceInvocationError('service-not-configured')
  }
  if (!(from in service.Language) || !(to in service.Language)) {
    throw new TranslateServiceInvocationError('language-not-supported')
  }

  const instanceConfig = serviceInstanceConfigMap[instanceKey]
  if (!instanceConfig) {
    throw new TranslateServiceInvocationError('service-not-configured')
  }

  return service.translate(text, service.Language[from], service.Language[to], {
    config: instanceConfig,
    detect,
    setResult: onStream,
  })
}
