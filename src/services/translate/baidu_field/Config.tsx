// @ts-nocheck
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { DropdownTrigger } from '@heroui/react';
import { Input, Button } from '@heroui/react';
import { DropdownMenu } from '@heroui/react';
import { DropdownItem } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@heroui/react';
import { openUrl as open } from '@tauri-apps/plugin-opener';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { translate } from './index';
import { Language } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.baidu_field.title'),
            appid: '',
            secret: '',
            field: 'it',
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);
    const fieldList = [
        'it',
        'finance',
        'machinery',
        'senimed',
        'novel',
        'academic',
        'aerospace',
        'wiki',
        'news',
        'law',
        'contract',
    ];

    const toastStyle = useToastStyle();

    return (
        config !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setConfig(config, true);
                    updateServiceList(instanceKey);
                    onClose();
                }}
            >
                <Toaster />
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
                            open('https://pot-app.com/docs/api/translate/baidu.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.translate.deepl.type')}</h3>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button variant='bordered'>{t(`services.translate.baidu_field.${config.field}`)}</Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            autoFocus='first'
                            aria-label='app language'
                            className='max-h-[50vh] overflow-y-auto'
                            onAction={(key) => {
                                setConfig({
                                    ...config,
                                    field: key,
                                });
                            }}
                        >
                            {fieldList.map((item) => {
                                return (
                                    <DropdownItem key={item}>
                                        {t(`services.translate.baidu_field.${item}`)}
                                    </DropdownItem>
                                );
                            })}
                        </DropdownMenu>
                    </Dropdown>
                </div>
                <div className={'config-item'}>
                    <Input
                        label={t('services.translate.baidu.appid')}
                        labelPlacement='outside-left'
                        value={config['appid']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                appid: value,
                            });
                        }}
                    />
                </div>
                <div className={'config-item'}>
                    <Input
                        label={t('services.translate.baidu.secret')}
                        labelPlacement='outside-left'
                        value={config['secret']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                secret: value,
                            });
                        }}
                    />
                </div>
                <Button
                    type='button'
                    onPress={() => {
                        setIsLoading(true);
                        translate('hello', Language.auto, Language.zh_cn, { config }).then(
                            () => {
                                setIsLoading(false);
                                toast.success(t('config.service.test_success'), { style: toastStyle });
                            },
                            (e) => {
                                setIsLoading(false);
                                toast.error(t('config.service.test_failed') + e.toString(), { style: toastStyle });
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
                    color='primary'
                    fullWidth
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
