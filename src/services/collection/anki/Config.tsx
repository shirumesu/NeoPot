import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Button, Input } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { openUrl as open } from '@tauri-apps/plugin-opener';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks';
import { useToastStyle } from '../../../hooks';
import { collection } from './index';

interface ConfigProps {
    instanceKey: string;
    updateServiceList: (key: string) => void;
    onClose: () => void;
}

interface AnkiConfig {
    [INSTANCE_NAME_CONFIG_KEY]: string;
    port: number | string;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export function Config(props: ConfigProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();
    const { instanceKey, updateServiceList, onClose } = props;
    const [ankiConfig, setAnkiConfig] = useConfig<AnkiConfig>(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.collection.anki.title'),
            port: 8765,
        },
        { sync: false }
    );

    const toastStyle = useToastStyle();

    return (
        ankiConfig !== null && (
            <>
                <Toaster />
                <form
                    onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        setAnkiConfig(ankiConfig, true);
                        updateServiceList(instanceKey);
                        onClose();
                    }}
                >
                    <div className='config-item'>
                        <Input
                            label={t('services.instance_name')}
                            labelPlacement='outside-left'
                            value={ankiConfig[INSTANCE_NAME_CONFIG_KEY]}
                            variant='bordered'
                            classNames={{
                                base: 'justify-between',
                                label: 'text-[length:--heroui-font-size-medium]',
                                mainWrapper: 'max-w-[50%]',
                            }}
                            onValueChange={(value) => {
                                setAnkiConfig({
                                    ...ankiConfig,
                                    [INSTANCE_NAME_CONFIG_KEY]: value,
                                });
                            }}
                        />
                    </div>
                    <div className={'config-item'}>
                        <h3 className='my-auto'>{t('services.help')}</h3>
                        <Button
                            onPress={() => {
                                open('https://pot-app.com/docs/api/collection/anki.html');
                            }}
                        >
                            {t('services.help')}
                        </Button>
                    </div>
                    <div className={'config-item'}>
                        <Input
                            label={t('services.collection.anki.port')}
                            labelPlacement='outside-left'
                            value={String(ankiConfig['port'])}
                            type='number'
                            variant='bordered'
                            classNames={{
                                base: 'justify-between',
                                label: 'text-[length:--heroui-font-size-medium]',
                                mainWrapper: 'max-w-[50%]',
                            }}
                            onValueChange={(value) => {
                                setAnkiConfig({
                                    ...ankiConfig,
                                    port: value,
                                });
                            }}
                        />
                    </div>
                    <Button
                        type='button'
                        onPress={() => {
                            setIsLoading(true);
                            collection('test', '测试', { config: ankiConfig }).then(
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
                        isLoading={isLoading}
                        fullWidth
                    >
                        {t('common.test')}
                    </Button>
                    <Button
                        type='submit'
                        isLoading={isLoading}
                        fullWidth
                        color='primary'
                    >
                        {t('common.save')}
                    </Button>
                </form>
            </>
        )
    );
}
