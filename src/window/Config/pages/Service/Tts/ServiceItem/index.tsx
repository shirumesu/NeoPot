import { Spacer, Button } from '@heroui/react';
import { MdDeleteOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { BiSolidEdit } from 'react-icons/bi';
import React from 'react';

import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
} from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/tts';
import { useConfig } from '../../../../../../hooks';

interface PluginInfo {
    icon: string;
    display: string;
}

interface ServiceInstanceConfig {
    [INSTANCE_NAME_CONFIG_KEY]?: string;
}

interface BuiltinService {
    info: {
        icon?: string;
    };
}

interface ServiceItemProps {
    serviceInstanceKey: string;
    pluginList: Record<string, PluginInfo>;
    deleteServiceInstance: (key: string) => void;
    setCurrentConfigKey: (key: string) => void;
    onConfigOpen: () => void;
}

const builtinServiceMap = builtinServices as Record<string, BuiltinService>;

export default function ServiceItem(props: ServiceItemProps) {
    const { serviceInstanceKey, pluginList, deleteServiceInstance, setCurrentConfigKey, onConfigOpen } = props;
    const { t } = useTranslation();

    const [serviceInstanceConfig, setServiceInstanceConfig] = useConfig<ServiceInstanceConfig>(serviceInstanceKey, {});

    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);

    return serviceSourceType === ServiceSourceType.PLUGIN && !(serviceName in pluginList) ? (
        <></>
    ) : (
        serviceInstanceConfig !== null && (
            <div className='bg-content2 rounded-md px-[10px] py-[20px] flex justify-between'>
                <div className='flex'>
                    {serviceSourceType === ServiceSourceType.BUILDIN && (
                        <>
                            <img
                                src={builtinServiceMap[serviceName].info.icon}
                                className='h-[24px] w-[24px] my-auto'
                                draggable={false}
                            />
                            <Spacer x={2} />
                            <h2 className='my-auto'>
                                {serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] ||
                                    t(`services.tts.${serviceName}.title`)}
                            </h2>
                        </>
                    )}
                    {serviceSourceType === ServiceSourceType.PLUGIN && (
                        <>
                            <img
                                src={pluginList[serviceName].icon}
                                className='h-[24px] w-[24px] my-auto'
                                draggable={false}
                            />
                            <Spacer x={2} />
                            <h2 className='my-auto'>{`${serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] || pluginList[serviceName].display} [${t('common.plugin')}]`}</h2>
                        </>
                    )}
                </div>
                <div className='flex'>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={() => {
                            setCurrentConfigKey(serviceInstanceKey);
                            onConfigOpen();
                        }}
                    >
                        <BiSolidEdit className='text-2xl' />
                    </Button>
                    <Spacer x={2} />
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        color='danger'
                        onPress={() => {
                            deleteServiceInstance(serviceInstanceKey);
                        }}
                    >
                        <MdDeleteOutline className='text-2xl' />
                    </Button>
                </div>
            </div>
        )
    );
}
