// @ts-nocheck
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Button, Input } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { openUrl as open } from '@tauri-apps/plugin-opener';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks';
import { useToastStyle } from '../../../hooks';
import { collection } from './index';

export function Config(props) {
    const [isLoading, setIsLoading] = useState(false);
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.collection.eudic.title'),
            name: 'pot',
            token: '',
        },
        { sync: false }
    );

    const toastStyle = useToastStyle();

    return (
        config !== null && (
            <>
                <Toaster />
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        setConfig(config, true);
                        updateServiceList(instanceKey);
                        onClose();
                    }}
                >
                    <div className='config-item'>
                        <Input
                            label={t('services.instance_name')}
                            labelPlacement='outside-left'
                            value={config[INSTANCE_NAME_CONFIG_KEY]}
                            variant='bordered'
                            classNames={{
                                base: 'justify-between',
                                label: 'text-[length:--heroui-font-size-medium]',
                                mainWrapper: 'max-w-[50%]',
                            }}
                            onValueChange={(value) => {
                                setConfig({
                                    ...config,
                                    [INSTANCE_NAME_CONFIG_KEY]: value,
                                });
                            }}
                        />
                    </div>
                    <div className={'config-item'}>
                        <h3 className='my-auto'>{t('services.help')}</h3>
                        <Button
                            onPress={() => {
                                open('https://pot-app.com/docs/api/collection/eudic.html');
                            }}
                        >
                            {t('services.help')}
                        </Button>
                    </div>
                    <div className={'config-item'}>
                        <Input
                            label={t('services.collection.eudic.name')}
                            labelPlacement='outside-left'
                            value={config['name']}
                            variant='bordered'
                            classNames={{
                                base: 'justify-between',
                                label: 'text-[length:--heroui-font-size-medium]',
                                mainWrapper: 'max-w-[50%]',
                            }}
                            onValueChange={(value) => {
                                setConfig({
                                    ...config,
                                    name: value,
                                });
                            }}
                        />
                    </div>
                    <div className={'config-item'}>
                        <Input
                            label={t('services.collection.eudic.token')}
                            labelPlacement='outside-left'
                            value={config['token']}
                            variant='bordered'
                            classNames={{
                                base: 'justify-between',
                                label: 'text-[length:--heroui-font-size-medium]',
                                mainWrapper: 'max-w-[50%]',
                            }}
                            onValueChange={(value) => {
                                setConfig({
                                    ...config,
                                    token: value,
                                });
                            }}
                        />
                    </div>
                    <div>
                        <Button
                            type='button'
                            onPress={() => {
                                setIsLoading(true);
                                collection('test', '测试', { config }).then(
                                    () => {
                                        setIsLoading(false);
                                        toast.success(t('config.service.test_success'), { style: toastStyle });
                                    },
                                    (e) => {
                                        setIsLoading(false);
                                        toast.error(t('config.service.test_failed') + e.toString(), {
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
                    </div>
                </form>
            </>
        )
    );
}
