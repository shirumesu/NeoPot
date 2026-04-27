// @ts-nocheck
import { Card, Spacer, Button, useDisclosure } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Reorder } from 'framer-motion';

import { useToastStyle } from '../../../../../hooks';
import SelectPluginModal from '../SelectPluginModal';
import { osType } from '../../../../../utils/env';
import { useConfig, deleteKey } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';

export default function Tts(props) {
    const { pluginList } = props;
    const {
        isOpen: isSelectPluginOpen,
        onOpen: onSelectPluginOpen,
        onOpenChange: onSelectPluginOpenChange,
    } = useDisclosure();
    const { isOpen: isSelectOpen, onOpen: onSelectOpen, onOpenChange: onSelectOpenChange } = useDisclosure();
    const { isOpen: isConfigOpen, onOpen: onConfigOpen, onOpenChange: onConfigOpenChange } = useDisclosure();
    const [currentConfigKey, setCurrentConfigKey] = useState('lingva_tts');
    // now it's service instance list
    const [ttsServiceInstanceList, setTtsServiceInstanceList] = useConfig('tts_service_list', ['lingva_tts']);

    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    const deleteServiceInstance = (instanceKey) => {
        if (ttsServiceInstanceList.length === 1) {
            toast.error(t('config.service.least'), { style: toastStyle });
            return;
        } else {
            setTtsServiceInstanceList(ttsServiceInstanceList.filter((x) => x !== instanceKey));
            deleteKey(instanceKey);
        }
    };
    const updateServiceInstanceList = (instanceKey) => {
        if (ttsServiceInstanceList.includes(instanceKey)) {
            return;
        } else {
            const newList = [...ttsServiceInstanceList, instanceKey];
            setTtsServiceInstanceList(newList);
        }
    };

    return (
        <>
            <Toaster />
            <Card
                className={`${
                    osType === 'Linux' ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-120px)]'
                } overflow-y-auto p-5 flex justify-between`}
            >
                {ttsServiceInstanceList !== null && (
                    <Reorder.Group
                        axis='y'
                        values={ttsServiceInstanceList}
                        onReorder={setTtsServiceInstanceList}
                        className='overflow-y-auto h-full'
                    >
                        {ttsServiceInstanceList.map((x) => {
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
                pluginType='tts'
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

