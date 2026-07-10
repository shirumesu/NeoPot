// @ts-check

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    'src/main/modules/configSecrets.ts',
    'src/main/modules/configRepository.ts',
    'src/main/modules/externalUrlSafety.ts',
    'src/main/modules/localServer.ts',
    'src/main/modules/networkSafety.ts',
    'src/main/modules/rendererProtocol.ts',
    'src/main/modules/updateVersion.ts',
    'src/main/plugins/marketplace.ts',
    'src/main/plugins/pluginInstallerCore.ts',
    'src/renderer/providers/translate/deepl/translate.ts',
    'src/renderer/providers/translate/google/translate.ts',
    'src/renderer/providers/translate/ollama/translate.ts',
    'src/renderer/providers/tts/lingva/tts.ts',
    'src/renderer/windows/Screenshot/selection.ts',
    'src/renderer/windows/Updater/useUpdaterController.ts',
    'src/shared/deeplConfig.ts',
    'src/shared/providerUrl.ts',
    'src/shared/proxyConfig.ts',
    'src/shared/serviceInstance.ts',
    'src/shared/translateWindowSizing.ts',
    'src/shared/translateWorkflow.ts',
  ],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
    related: true,
  },
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: {
    fileName: 'test-results/mutation/mutation.html',
  },
  jsonReporter: {
    fileName: 'test-results/mutation/mutation.json',
  },
  thresholds: {
    high: 80,
    low: 60,
    break: 0,
  },
  tempDirName: 'test-results/.stryker-tmp',
  cleanTempDir: 'always',
}
