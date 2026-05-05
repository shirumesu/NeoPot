// @ts-nocheck
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Button, Input } from '@heroui/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useConfig } from '../../../hooks/useConfig';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.local_model.title'),
        },
        { sync: false }
    );

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
                <div className='mb-3 rounded-medium border border-default-200 bg-content2 px-3 py-2 text-sm text-default-600'>
                    {t('services.recognize.local_model.description')}
                </div>
                <Button
                    type='submit'
                    color='primary'
                    fullWidth
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
