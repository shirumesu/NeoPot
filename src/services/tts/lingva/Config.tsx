import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Button, Input } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { openUrl as open } from '@tauri-apps/plugin-opener';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { Language } from './index';
import { tts } from './index';

interface ConfigProps {
    instanceKey: string;
    updateServiceList: (key: string) => void;
    onClose: () => void;
}

interface LingvaConfig {
    [INSTANCE_NAME_CONFIG_KEY]: string;
    requestPath: string;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export function Config(props: ConfigProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [lingvaConfig, setLingvaConfig] = useConfig<LingvaConfig>(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.lingva_tts.title'),
            requestPath: 'lingva.pot-app.com',
        },
        { sync: false }
    );

    const toastStyle = useToastStyle();

    return (
        lingvaConfig !== null && (
            <>
                <Toaster />
                <div className='config-item'>
                    <Input
                        label={t('services.instance_name')}
                        labelPlacement='outside-left'
                        value={lingvaConfig[INSTANCE_NAME_CONFIG_KEY]}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setLingvaConfig({
                                ...lingvaConfig,
                                [INSTANCE_NAME_CONFIG_KEY]: value,
                            });
                        }}
                    />
                </div>
                <div className={'config-item'}>
                    <h3 className='my-auto'>{t('services.help')}</h3>
                    <Button
                        onPress={() => {
                            open('https://pot-app.com/docs/api/tts/lingva.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className={'config-item'}>
                    <h3 className='my-auto'>{t('services.tts.lingva_tts.request_path')}</h3>
                    <Input
                        value={lingvaConfig['requestPath']}
                        variant='bordered'
                        className='max-w-[50%]'
                        onValueChange={(value) => {
                            setLingvaConfig({
                                ...lingvaConfig,
                                requestPath: value,
                            });
                        }}
                    />
                </div>
                <div>
                    <Button
                        isLoading={isLoading}
                        fullWidth
                        onPress={() => {
                            setIsLoading(true);
                            tts('hello', Language.en, { config: lingvaConfig }).then(
                                () => {
                                    setIsLoading(false);
                                    toast.success(t('config.service.test_success'), { style: toastStyle });
                                },
                                (e: unknown) => {
                                    setIsLoading(false);
                                    toast.error(t('config.service.test_failed') + getErrorMessage(e), {
                                        style: toastStyle,
                                    });
                                }
                            );
                        }}
                    >
                        {t('common.test')}
                    </Button>
                    <Button
                        fullWidth
                        color='primary'
                        onPress={() => {
                            setLingvaConfig(lingvaConfig, true);
                            updateServiceList(instanceKey);
                            onClose();
                        }}
                    >
                        {t('common.save')}
                    </Button>
                </div>
            </>
        )
    );
}
