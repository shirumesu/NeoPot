export {
  ServiceSourceType,
  createServiceInstanceKey,
  getDisplayInstanceName,
  getServiceName,
  getServiceSouceType,
  INSTANCE_NAME_CONFIG_KEY,
  isServiceInstanceForPlugin,
  isValidServiceInstanceKey,
  whetherAvailableService,
  whetherPluginService,
} from '../../../shared/serviceInstance'

export enum ServiceType {
  TRANSLATE = 'translate',
  RECOGNIZE = 'recognize',
  TTS = 'tts',
}
