// @ts-nocheck
import { Card, Spacer, Button, useDisclosure } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Reorder } from 'framer-motion';

import SelectPluginModal from '../SelectPluginModal';
import { osType } from '../../../../../utils/env';
import { useConfig, deleteKey } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';

export default function Collection(props) {
    const { pluginList } = props;
    const {
        isOpen: isSelectPluginOpen,
        onOpen: onSelectPluginOpen,
        onOpenChange: onSelectPluginOpenChange,
    } = useDisclosure();
    const { isOpen: isSelectOpen, onOpen: onSelectOpen, onOpenChange: onSelectOpenChange } = useDisclosure();
    const { isOpen: isConfigOpen, onOpen: onConfigOpen, onOpenChange: onConfigOpenChange } = useDisclosure();
    const [currentConfigKey, setCurrentConfigKey] = useState('anki');
    // now it's service instance list
    const [collectionServiceInstanceList, setCollectionServiceInstanceList] = useConfig('collection_service_list', []);

    const { t } = useTranslation();

    const deleteServiceInstance = (instanceKey) => {
        setCollectionServiceInstanceList(collectionServiceInstanceList.filter((x) => x !== instanceKey));
        deleteKey(instanceKey);
    };
    const updateServiceInstanceList = (instanceKey) => {
        if (collectionServiceInstanceList.includes(instanceKey)) {
            return;
        } else {
            const newList = [...collectionServiceInstanceList, instanceKey];
            setCollectionServiceInstanceList(newList);
        }
    };

    return (
        <>
            <Card
                className={`${
                    osType === 'Linux' ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-120px)]'
                } overflow-y-auto p-5 flex justify-between`}
            >
                {collectionServiceInstanceList !== null && (
                    <Reorder.Group
                        axis='y'
                        values={collectionServiceInstanceList}
                        onReorder={setCollectionServiceInstanceList}
                        className='overflow-y-auto h-full'
                    >
                        {collectionServiceInstanceList.map((x) => {
                            return (
                                <Reorder.Item
                                    key={x}
                                    value={x}
                                >
                                    <ServiceItem
                                        serviceInstanceKey={x}
                                        pluginList={pluginList}
                                        deleteServiceInstance={deleteServiceInstance}
                                        setCurrentConfigKey={setCurrentConfigKey}
                                        onConfigOpen={onConfigOpen}
                                    />
                                    <Spacer y={2} />
                                </Reorder.Item>
                            );
                        })}
                    </Reorder.Group>
                )}
                <Spacer y={2} />
                <div className='flex'>
                    <Button
                        fullWidth
                        onPress={onSelectOpen}
                    >
                        {t('config.service.add_builtin_service')}
                    </Button>
                    <Spacer x={2} />
                    <Button
                        fullWidth
                        onPress={onSelectPluginOpen}
                    >
                        {t('config.service.add_external_service')}
                    </Button>
                </div>
            </Card>
            <SelectPluginModal
                isOpen={isSelectPluginOpen}
                onOpenChange={onSelectPluginOpenChange}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
                pluginType='collection'
                pluginList={pluginList}
                deleteService={deleteServiceInstance}
            />
            <SelectModal
                isOpen={isSelectOpen}
                onOpenChange={onSelectOpenChange}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
            />
            <ConfigModal
                serviceInstanceKey={currentConfigKey}
                isOpen={isConfigOpen}
                pluginList={pluginList}
                onOpenChange={onConfigOpenChange}
                updateServiceInstanceList={updateServiceInstanceList}
            />
        </>
    );
}

